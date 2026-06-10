'use client';

import { useMemo } from 'react';
import { useViewerStore } from '@/store/useViewerStore';
import { structures, byId, SYSTEMS, type Structure } from '@/data/catalog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Search, Crosshair, ScanSearch } from 'lucide-react';

const SYSTEM_LABEL = Object.fromEntries(SYSTEMS.map((s) => [s.id, s.label]));

function matches(s: Structure, q: string): boolean {
  if (!q) return true;
  const hay = [s.nameEn, s.nameLatin, s.nameFa, s.region, ...s.aliases].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function Sidebar() {
  const selectedId = useViewerStore((s) => s.selectedId);
  const searchQuery = useViewerStore((s) => s.searchQuery);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const setHoveredId = useViewerStore((s) => s.setHoveredId);
  const setSearchQuery = useViewerStore((s) => s.setSearchQuery);
  const focusSelection = useViewerStore((s) => s.focusSelection);
  const toggleIsolate = useViewerStore((s) => s.toggleIsolate);
  const isolate = useViewerStore((s) => s.isolate);

  const selected = selectedId ? byId.get(selectedId) : undefined;

  // group filtered structures: system -> region -> [structures]
  const grouped = useMemo(() => {
    const out = new Map<string, Map<string, Structure[]>>();
    for (const s of structures) {
      if (!matches(s, searchQuery)) continue;
      if (!out.has(s.system)) out.set(s.system, new Map());
      const byRegion = out.get(s.system)!;
      if (!byRegion.has(s.region)) byRegion.set(s.region, []);
      byRegion.get(s.region)!.push(s);
    }
    return out;
  }, [searchQuery]);

  const total = useMemo(
    () => structures.filter((s) => matches(s, searchQuery)).length,
    [searchQuery],
  );

  return (
    <div className="w-80 h-full bg-background border-l flex flex-col shadow-xl z-10 relative">
      <div className="p-4 border-b bg-muted/30">
        <h2 className="text-xl font-bold tracking-tight mb-4">Anatomy Explorer</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search bones & muscles…"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {selected ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectStructure(null)}
              className="w-full"
            >
              ← Back to list
            </Button>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1 gap-1.5" onClick={focusSelection}>
                <ScanSearch className="h-4 w-4" /> Focus
              </Button>
              <Button
                variant={isolate ? 'default' : 'secondary'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={toggleIsolate}
              >
                <Crosshair className="h-4 w-4" /> Isolate
              </Button>
            </div>

            <Card className="border-primary/20 shadow-sm overflow-hidden">
              <div className="bg-primary/10 h-2 w-full" />
              <CardHeader className="pb-2">
                <CardTitle className="text-xl leading-tight text-primary">
                  {selected.nameEn}
                </CardTitle>
                {selected.nameFa && (
                  <CardDescription className="text-lg font-medium text-foreground mt-1">
                    {selected.nameFa}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{SYSTEM_LABEL[selected.system]}</Badge>
                  {selected.region !== selected.system &&
                    !['skeleton', 'other'].includes(selected.region) && (
                      <Badge variant="outline" className="capitalize">
                        {selected.region.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  {selected.system === 'muscular' && (
                    <Badge variant="outline" className="capitalize">
                      {selected.depth}
                    </Badge>
                  )}
                </div>
                {selected.nameLatin !== selected.nameEn && (
                  <p className="text-sm text-muted-foreground italic">{selected.nameLatin}</p>
                )}
                {selected.descriptionEn && (
                  <p className="text-sm leading-relaxed">{selected.descriptionEn}</p>
                )}
                {selected.aliases.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-1">Includes</h4>
                    <p className="text-xs text-muted-foreground">
                      {selected.aliases.slice(0, 12).join(' · ')}
                      {selected.aliases.length > 12 ? ' …' : ''}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground px-1">{total} structures</h3>
            {total === 0 && (
              <p className="text-sm text-center text-muted-foreground py-8">No matches.</p>
            )}
            {[...grouped.entries()].map(([system, byRegion]) => (
              <div key={system} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-1">
                  {SYSTEM_LABEL[system]}
                </h4>
                {[...byRegion.entries()].map(([region, list]) => (
                  <div key={region} className="space-y-0.5">
                    <p className="text-[11px] font-medium text-muted-foreground/70 px-1 capitalize">
                      {region.replace(/_/g, ' ')} ({list.length})
                    </p>
                    {list.map((s) => (
                      <button
                        key={s.id}
                        className="w-full text-left px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
                        onClick={() => selectStructure(s.id)}
                        onMouseEnter={() => setHoveredId(s.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        {s.nameEn}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
