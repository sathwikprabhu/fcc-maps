import crypto from 'crypto';
import https from 'https';
import { storage } from '../services/storage';
import { Marker, Settings, SyncStatus, SyncStats } from '../types';

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastHash: string | null = null;

  constructor() {
    // Load last hash from status if available
    const status = storage.getStatus();
    // We will store the hash in status.stats (extending it or storing it as metadata)
    // For simplicity, let's read/write hash on the status object itself.
    // Let's cast status to any to retrieve apiHash if it was saved.
    this.lastHash = (status as any).apiHash || null;
  }

  public start(): void {
    storage.addLog('info', 'Scheduler service started');
    this.scheduleNext();
    
    // Run an initial sync in background on startup if never synced or if server restarted
    const status = storage.getStatus();
    if (!status.lastSyncTime) {
      this.sync().catch(err => {
        storage.addLog('error', 'Initial sync on startup failed', String(err));
      });
    }
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    storage.addLog('info', 'Scheduler service stopped');
  }

  public reschedule(): void {
    storage.addLog('info', 'Rescheduling sync job due to settings change');
    this.lastHash = null; // Reset hash to force markers.json rebuild on settings change
    this.stop();
    this.scheduleNext();
  }

  private scheduleNext(): void {
    const settings = storage.getSettings();
    const intervalHours = settings.syncIntervalHours || 12;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    // Update status to show when next sync is
    const status = storage.getStatus();
    status.nextSyncTime = new Date(Date.now() + intervalMs).toISOString();
    storage.saveStatus(status);

    this.timer = setTimeout(() => {
      this.sync()
        .catch(err => {
          storage.addLog('error', 'Scheduled sync failed', String(err));
        })
        .finally(() => {
          this.scheduleNext();
        });
    }, intervalMs);
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  private parseCoordinates(excerpt: string): { lat: number; lng: number } | null {
    const cleanExcerpt = this.stripHtml(excerpt);
    // Look for numbers like: 46.23307388854503, 6.055512805451645
    // Matches positive or negative floats separated by comma (and optional spaces)
    const match = cleanExcerpt.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (!match) return null;

    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    if (isNaN(lat) || isNaN(lng)) return null;

    return { lat, lng };
  }

  private parseWebsiteUrl(content: string): string | null {
    if (!content) return null;
    
    // Search for element with id="website-url"
    const match = content.match(/<[^>]*id=["']website-url["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
    if (!match) return null;

    const innerHtml = match[1].trim();

    // Check if it contains an anchor tag with href
    const hrefMatch = innerHtml.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
      return hrefMatch[1].trim();
    }

    // Otherwise, strip HTML tags and return clean text
    const plainText = innerHtml.replace(/<[^>]*>/g, '').trim();
    if (!plainText) return null;

    // Ensure it has a protocol prefix
    if (!/^https?:\/\//i.test(plainText)) {
      return `http://${plainText}`;
    }

    return plainText;
  }

  public async sync(manual = false): Promise<void> {
    if (this.isSyncing) {
      storage.addLog('warn', 'Sync already in progress, skipping execution');
      return;
    }

    this.isSyncing = true;
    const settings = storage.getSettings();
    const status = storage.getStatus();
    
    status.status = 'syncing';
    storage.saveStatus(status);
    
    storage.addLog('info', `Starting synchronization (${manual ? 'Manual' : 'Scheduled'})`, `API URL: ${settings.wpApiUrl || 'None configured'}`);

    if (!settings.wpApiUrl) {
      const errorMsg = 'WordPress API URL is not configured. Sync skipped.';
      status.status = 'failed';
      status.lastError = errorMsg;
      storage.saveStatus(status);
      storage.addLog('error', errorMsg);
      this.isSyncing = false;
      return;
    }

    const maxRetries = 3;
    let attempt = 0;
    let success = false;
    let allPosts: any[] = [];

    while (attempt < maxRetries && !success) {
      attempt++;
      try {
        allPosts = await this.fetchWordPressPosts(settings);
        success = true;
      } catch (error) {
        const errStr = error instanceof Error && (error as any).cause
          ? `${error.message} (Cause: ${(error as any).cause.message || String((error as any).cause)})`
          : String(error);
        storage.addLog('warn', `Fetch attempt ${attempt}/${maxRetries} failed`, errStr);
        if (attempt < maxRetries) {
          // Wait 5 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          status.status = 'failed';
          status.lastError = `Failed to fetch after ${maxRetries} attempts: ${errStr}`;
          storage.saveStatus(status);
          storage.addLog('error', `Sync failed: ${errStr}`);
          this.isSyncing = false;
          return;
        }
      }
    }

    // Process posts if fetch succeeded
    try {
      // Calculate API content hash
      const contentStr = JSON.stringify(allPosts);
      const hash = crypto.createHash('sha256').update(contentStr).digest('hex');

      let invalidPostsCount = 0;
      let duplicateCoordinatesCount = 0;
      const markers: Marker[] = [];
      const coordSet = new Set<string>();

      for (const post of allPosts) {
        if (!post.id || !post.title?.rendered || !post.excerpt?.rendered) {
          invalidPostsCount++;
          continue;
        }

        const coords = this.parseCoordinates(post.excerpt.rendered);
        if (!coords) {
          invalidPostsCount++;
          storage.addLog('warn', `Validation Skip: Post ID ${post.id} ("${post.title.rendered}") excerpt contains no coordinates.`, `Excerpt: ${post.excerpt.rendered}`);
          continue;
        }

        const { lat, lng } = coords;

        // Validate coordinate bounds
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          invalidPostsCount++;
          storage.addLog('warn', `Validation Skip: Post ID ${post.id} ("${post.title.rendered}") coordinates out of bounds.`, `Coords: ${lat}, ${lng}`);
          continue;
        }

        // Handle duplicates
        const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
        if (coordSet.has(coordKey)) {
          duplicateCoordinatesCount++;
          if (!settings.enableClustering) {
            // If clustering is NOT enabled, ignore duplicate coordinates to prevent overlapping markers
            storage.addLog('warn', `Validation Skip: Duplicate coordinates for Post ID ${post.id} ("${post.title.rendered}")`, `Coords: ${lat}, ${lng}`);
            continue;
          }
        }
        coordSet.add(coordKey);

        // Extract metadata: category, country, featured image
        let category = 'Uncategorized';
        let country = 'Unknown';
        const tags: string[] = [];
        let imageUrl = '';

        // Extract embedded terms if available
        if (post._embedded && post._embedded['wp:term']) {
          const termsList: any[][] = post._embedded['wp:term'];
          for (const terms of termsList) {
            for (const term of terms) {
              if (term.taxonomy === 'category') {
                category = term.name;
              } else if (term.taxonomy === 'post_tag') {
                tags.push(term.name);
              } else if (term.taxonomy === 'country') {
                country = term.name;
              }
            }
          }
        }

        // Fallback for featured image (standard media query embed path)
        if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
          imageUrl = post._embedded['wp:featuredmedia'][0].source_url || '';
        }

        // Clean link to point to original WordPress page, fallback if website-url tag not found
        let url = post.link || '';
        if (post.content && post.content.rendered) {
          const extractedUrl = this.parseWebsiteUrl(post.content.rendered);
          if (extractedUrl) {
            url = extractedUrl;
          }
        }

        markers.push({
          id: post.id,
          title: post.title.rendered,
          latitude: Number(lat.toFixed(5)),
          longitude: Number(lng.toFixed(5)),
          url,
          category,
          country,
          tags,
          imageUrl,
        });
      }

      // Check if hash matches the previous hash (skip check on manual sync)
      if (!manual && hash === this.lastHash && storage.getMarkersSize() > 0) {
        storage.addLog('info', 'No content changes detected. Skip regenerating markers.json.');
      } else {
        // Content changed, write markers.json
        const sizeBytes = storage.saveMarkers(markers);
        this.lastHash = hash;
        storage.addLog('info', `Successfully regenerated markers.json with ${markers.length} markers (${(sizeBytes / 1024).toFixed(2)} KB)`);
      }

      // Update sync statistics
      const finalStats: SyncStats = {
        markerCount: markers.length,
        invalidPostsCount,
        duplicateCoordinatesCount,
        jsonFileSize: storage.getMarkersSize(),
      };

      status.lastSyncTime = new Date().toISOString();
      status.status = 'idle';
      status.lastError = null;
      status.stats = finalStats;
      (status as any).apiHash = this.lastHash; // persist the hash in status JSON

      storage.saveStatus(status);
      storage.addLog('info', 'Sync completed successfully');

    } catch (processError) {
      const errStr = String(processError);
      status.status = 'failed';
      status.lastError = `Error processing WordPress posts: ${errStr}`;
      storage.saveStatus(status);
      storage.addLog('error', `Sync processing error: ${errStr}`);
    } finally {
      this.isSyncing = false;
    }
  }

  private async fetchWordPressPosts(settings: Settings): Promise<any[]> {
    let allPosts: any[] = [];
    let page = 1;
    const perPage = 100;
    let fetchMore = true;

    // Build auth headers
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (settings.authEnabled && settings.username && settings.password) {
      const credentials = Buffer.from(`${settings.username}:${settings.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    while (fetchMore) {
      const separator = settings.wpApiUrl.includes('?') ? '&' : '?';
      // Request embedded fields (e.g. categories, media) to get images and terms in one call
      const url = `${settings.wpApiUrl}${separator}page=${page}&per_page=${perPage}&_embed=1`;

      // Use a scoped agent that allows self-signed certs only for this endpoint
      // (needed for CERN intranet). Does NOT affect any other outbound connections.
      const agent = new https.Agent({ rejectUnauthorized: false });
      const response = await fetch(url, { headers, ...(url.startsWith('https:') ? { dispatcher: undefined } : {}), agent } as any);

      if (!response.ok) {
        // If we get a 400 page error on page > 1, it means we hit the end of pages in WordPress pagination.
        if (page > 1 && (response.status === 400 || response.status === 404)) {
          fetchMore = false;
          break;
        }
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
      }

      const posts = await response.json();
      if (!Array.isArray(posts) || posts.length === 0) {
        fetchMore = false;
        break;
      }

      allPosts = allPosts.concat(posts);

      // If we got fewer posts than requested, we've reached the end
      if (posts.length < perPage) {
        fetchMore = false;
      } else {
        page++;
      }
    }

    return allPosts;
  }
}

export const scheduler = new SchedulerService();
