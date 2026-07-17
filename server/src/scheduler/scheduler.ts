import crypto from 'crypto';
import https from 'https';
import { storage } from '../services/storage';
import { Marker, Settings, SyncStatus, SyncStats } from '../types';

export class SchedulerService {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private syncingStatus: Map<string, boolean> = new Map();
  private lastHashes: Map<string, string> = new Map();

  constructor() {
    // Hashes will be populated dynamically as sync runs
  }

  public start(): void {
    storage.addLog('info', 'Scheduler service started');
    
    // Only start background sync job for the default map (global dataset)
    this.scheduleNext('default');
    
    const status = storage.getStatus('default');
    if (!status.lastSyncTime) {
      this.sync('default').catch(err => {
        storage.addLog('error', `Initial sync on startup failed`, String(err), 'default');
      });
    }
  }

  public stop(): void {
    this.timers.forEach((timer, mapId) => {
      clearTimeout(timer);
      storage.addLog('info', 'Scheduler job stopped', undefined, mapId);
    });
    this.timers.clear();
    storage.addLog('info', 'Scheduler service stopped');
  }

  public stopMapJob(mapId: string): void {
    const timer = this.timers.get(mapId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(mapId);
      this.syncingStatus.delete(mapId);
      this.lastHashes.delete(mapId);
      storage.addLog('info', 'Scheduler job stopped for map', undefined, mapId);
    }
  }

  public rescheduleMap(mapId: string): void {
    if (mapId !== 'default') {
      return; // Only default map runs a sync schedule
    }
    storage.addLog('info', 'Rescheduling sync job due to settings change', undefined, mapId);
    this.lastHashes.delete(mapId); // Reset hash to force markers.json rebuild on settings change
    this.stopMapJob(mapId);
    this.scheduleNext(mapId);
  }

  private scheduleNext(mapId: string): void {
    const settings = storage.getSettings(mapId);
    const intervalHours = settings.syncIntervalHours || 12;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    // Update status to show when next sync is
    const status = storage.getStatus(mapId);
    status.nextSyncTime = new Date(Date.now() + intervalMs).toISOString();
    storage.saveStatus(status, mapId);

    const timer = setTimeout(() => {
      this.sync(mapId)
        .catch(err => {
          storage.addLog('error', 'Scheduled sync failed', String(err), mapId);
        })
        .finally(() => {
          this.scheduleNext(mapId);
        });
    }, intervalMs);

    this.timers.set(mapId, timer);
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  private parseCoordinates(excerpt: string): { lat: number; lng: number } | null {
    const cleanExcerpt = this.stripHtml(excerpt);
    const match = cleanExcerpt.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (!match) return null;

    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    if (isNaN(lat) || isNaN(lng)) return null;

    return { lat, lng };
  }

  private parseWebsiteUrl(content: string): string | null {
    if (!content) return null;
    
    const match = content.match(/<[^>]*id=["']website-url["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
    if (match) {
      const innerHtml = match[1].trim();
      const hrefMatch = innerHtml.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        return hrefMatch[1].trim();
      }
      const plainText = innerHtml.replace(/<[^>]*>/g, '').trim();
      if (plainText) {
        if (!/^https?:\/\//i.test(plainText)) {
          return `http://${plainText}`;
        }
        return plainText;
      }
    }
    return null;
  }

  public async sync(mapId: string = 'default', manual = false): Promise<void> {
    if (this.syncingStatus.get(mapId)) {
      storage.addLog('warn', 'Sync already in progress, skipping execution', undefined, mapId);
      return;
    }

    this.syncingStatus.set(mapId, true);
    const settings = storage.getSettings(mapId);
    const status = storage.getStatus(mapId);
    
    status.status = 'syncing';
    storage.saveStatus(status, mapId);
    
    storage.addLog('info', `Starting synchronization (${manual ? 'Manual' : 'Scheduled'})`, `API URL: ${settings.wpApiUrl || 'None configured'}`, mapId);

    if (!settings.wpApiUrl) {
      const errorMsg = 'WordPress API URL is not configured. Sync skipped.';
      status.status = 'failed';
      status.lastError = errorMsg;
      storage.saveStatus(status, mapId);
      storage.addLog('error', errorMsg, undefined, mapId);
      this.syncingStatus.set(mapId, false);
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
        storage.addLog('warn', `Fetch attempt ${attempt}/${maxRetries} failed`, errStr, mapId);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          status.status = 'failed';
          status.lastError = `Failed to fetch after ${maxRetries} attempts: ${errStr}`;
          storage.saveStatus(status, mapId);
          storage.addLog('error', `Sync failed: ${errStr}`, undefined, mapId);
          this.syncingStatus.set(mapId, false);
          return;
        }
      }
    }

    // Process posts if fetch succeeded
    try {
      const contentStr = JSON.stringify(allPosts);
      const hash = crypto.createHash('sha256').update(contentStr).digest('hex');

      let invalidPostsCount = 0;
      let duplicateCoordinatesCount = 0;
      const markers: Marker[] = [];
      const coordSet = new Set<string>();

      for (const post of allPosts) {
        if (!post.id || !post.title?.rendered) {
          invalidPostsCount++;
          continue;
        }

        let category = 'Uncategorized';
        let country = 'Unknown';
        const tags: string[] = [];
        let imageUrl = '';

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

        if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
          imageUrl = post._embedded['wp:featuredmedia'][0].source_url || '';
        }

        let url = post.link || '';
        if (post.content && post.content.rendered) {
          const extractedUrl = this.parseWebsiteUrl(post.content.rendered);
          if (extractedUrl) url = extractedUrl;
        }

        let lat: number | null = null;
        let lng: number | null = null;
        let hasCoordinates = false;

        if (post.excerpt?.rendered) {
          const coords = this.parseCoordinates(post.excerpt.rendered);
          if (coords) {
            const { lat: parsedLat, lng: parsedLng } = coords;
            if (parsedLat >= -90 && parsedLat <= 90 && parsedLng >= -180 && parsedLng <= 180) {
              lat = Number(parsedLat.toFixed(5));
              lng = Number(parsedLng.toFixed(5));
              hasCoordinates = true;

              const coordKey = `${lat},${lng}`;
              if (coordSet.has(coordKey)) {
                duplicateCoordinatesCount++;
                if (!settings.enableClustering) {
                  storage.addLog('warn', `Validation Skip: Duplicate coordinates for Post ID ${post.id} ("${post.title.rendered}")`, `Coords: ${lat}, ${lng}`, mapId);
                  hasCoordinates = false;
                }
              }
              if (hasCoordinates) coordSet.add(coordKey);
            } else {
              invalidPostsCount++;
              storage.addLog('warn', `Post ID ${post.id} ("${post.title.rendered}") coordinates out of bounds.`, `Coords: ${parsedLat}, ${parsedLng}`, mapId);
            }
          } else {
            invalidPostsCount++;
            storage.addLog('warn', `Post ID ${post.id} ("${post.title.rendered}") has no coordinates — included in export only.`, undefined, mapId);
          }
        } else {
          invalidPostsCount++;
        }

        markers.push({
          id: post.id,
          title: post.title.rendered,
          latitude: lat,
          longitude: lng,
          hasCoordinates,
          url,
          category,
          country,
          tags,
          imageUrl,
        });
      }

      const lastHash = this.lastHashes.get(mapId) || null;
      if (!manual && hash === lastHash && storage.getMarkersSize(mapId) > 0) {
        storage.addLog('info', 'No content changes detected. Skip regenerating markers.json.', undefined, mapId);
      } else {
        const sizeBytes = storage.saveMarkers(markers, mapId);
        this.lastHashes.set(mapId, hash);
        const withCoords = markers.filter(m => m.hasCoordinates).length;
        storage.addLog('info', `Successfully regenerated markers.json with ${markers.length} total entries (${withCoords} with coordinates, ${(sizeBytes / 1024).toFixed(2)} KB)`, undefined, mapId);
      }

      const finalStats: SyncStats = {
        markerCount: markers.filter(m => m.hasCoordinates).length,
        allPostsCount: markers.length,
        invalidPostsCount,
        duplicateCoordinatesCount,
        jsonFileSize: storage.getMarkersSize(mapId),
      };

      status.lastSyncTime = new Date().toISOString();
      status.status = 'idle';
      status.lastError = null;
      status.stats = finalStats;
      (status as any).apiHash = hash;

      storage.saveStatus(status, mapId);
      storage.addLog('info', 'Sync completed successfully', undefined, mapId);

    } catch (processError) {
      const errStr = String(processError);
      status.status = 'failed';
      status.lastError = `Error processing WordPress posts: ${errStr}`;
      storage.saveStatus(status, mapId);
      storage.addLog('error', `Sync processing error: ${errStr}`, undefined, mapId);
    } finally {
      this.syncingStatus.set(mapId, false);
    }
  }

  private async fetchWordPressPosts(settings: Settings): Promise<any[]> {
    let allPosts: any[] = [];
    let page = 1;
    const perPage = 100;
    let fetchMore = true;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (settings.authEnabled && settings.username && settings.password) {
      const credentials = Buffer.from(`${settings.username}:${settings.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    while (fetchMore) {
      const separator = settings.wpApiUrl.includes('?') ? '&' : '?';
      const url = `${settings.wpApiUrl}${separator}page=${page}&per_page=${perPage}&_embed=1`;

      const allowSelfSigned = process.env.ALLOW_SELF_SIGNED_CERTS === 'true';
      const agent = new https.Agent({ rejectUnauthorized: !allowSelfSigned });
      const response = await fetch(url, { headers, agent } as any);

      if (!response.ok) {
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
