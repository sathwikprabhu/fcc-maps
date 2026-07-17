import { useState, useEffect } from 'react';
import { useGlobal } from '../context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Database, FileText, CheckCircle2, Clock, Sliders,
  RefreshCw, Trash2, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Metrics() {
  const { status, logs, syncingLocal, handleSyncNow, handleClearLogs, fetchStatusAndLogs } = useGlobal();
  const selectedMapId = 'default';
  const [expandedLogIdx, setExpandedLogIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchStatusAndLogs(selectedMapId);

    // Refresh periodically if syncing
    let interval: ReturnType<typeof setInterval>;
    if (status?.status === 'syncing') {
      interval = setInterval(() => fetchStatusAndLogs(selectedMapId), 3000);
    }
    return () => clearInterval(interval);
  }, [selectedMapId, status?.status]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">System Metrics</h1>
      </div>

      {status?.status === 'failed' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Last sync failed</AlertTitle>
          <AlertDescription>{status.lastError}</AlertDescription>
        </Alert>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" /> Active Markers
            </CardDescription>
            <CardTitle className="text-2xl font-medium">{status?.stats.markerCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Clean parsed posts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Cache File Size
            </CardDescription>
            <CardTitle className="text-2xl font-medium">{formatSize(status?.stats.jsonFileSize ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">markers.json footprint</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Last Sync
            </CardDescription>
            <CardTitle className="text-lg truncate">
              {status?.lastSyncTime ? new Date(status.lastSyncTime).toLocaleTimeString() : 'Never'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {status?.lastSyncTime ? new Date(status.lastSyncTime).toLocaleDateString() : 'No history'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Next Sync
            </CardDescription>
            <CardTitle className="text-lg truncate">
              {status?.nextSyncTime ? new Date(status.nextSyncTime).toLocaleTimeString() : 'Never'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {status?.nextSyncTime ? new Date(status.nextSyncTime).toLocaleDateString() : 'Awaiting config'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sliders className="h-4 w-4" /> Ingestion Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valid markers</span>
              <span className="font-medium">{status?.stats.markerCount ?? 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total posts</span>
              <span className="font-medium">{status?.stats.allPostsCount ?? 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Missing coords</span>
              <span className="font-medium">{status?.stats.invalidPostsCount ?? 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Duplicates</span>
              <span className="font-medium">{status?.stats.duplicateCoordinatesCount ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
            <div>
              <CardTitle className="text-base">System Logs</CardTitle>
              <CardDescription>Recent synchronization activity</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClearLogs(selectedMapId)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Clear
              </Button>
              <Button
                size="sm"
                onClick={() => handleSyncNow(selectedMapId)}
                disabled={syncingLocal || status?.status === 'syncing'}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${status?.status === 'syncing' ? 'animate-spin' : ''}`} />
                {status?.status === 'syncing' ? 'Syncing...' : 'Force Sync'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No logs available
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log, idx) => (
                  <div key={idx} className="border rounded-md text-sm">
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setExpandedLogIdx(expandedLogIdx === idx ? null : idx)}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${log.level === 'error' ? 'bg-destructive/10 text-destructive' :
                            log.level === 'warn' ? 'bg-yellow-500/10 text-yellow-600' :
                              'bg-primary/10 text-primary'
                          }`}>
                          {log.level}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="truncate">{log.message}</span>
                      </div>
                      {expandedLogIdx === idx ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {expandedLogIdx === idx && log.details && (
                      <div className="p-3 border-t bg-muted/20 font-mono text-xs overflow-x-auto">
                        <pre>{log.details}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
