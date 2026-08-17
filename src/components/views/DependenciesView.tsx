'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { WBPFlat, DependencyWithWBPs, ProgramDashboardData } from '@/lib/types';

const HEALTH_COLORS: Record<string, string> = {
  'on-track': '#22C55E',
  'at-risk': '#F59E0B',
  'off-track': '#EF4444',
  completed: '#3B82F6',
};

interface FlatWBP {
  id: string;
  code: string;
  name: string;
  health: string;
  teamColor: string;
  x: number;
  y: number;
}

interface Edge {
  id: string;
  from: string;
  to: string;
  type: string;
  status: string;
}

function flattenWbps(list: WBPFlat[]): FlatWBP[] {
  const result: FlatWBP[] = [];
  const flatten = (w: WBPFlat) => {
    result.push({
      id: w.id,
      code: w.code,
      name: w.name,
      health: w.health,
      teamColor: w.ownerTeam?.color || '#71717A',
      x: 0,
      y: 0,
    });
    w.children?.forEach(flatten);
  };
  list.forEach(flatten);
  return result;
}

function flattenDeps(wbps: WBPFlat[]): Edge[] {
  const edges: Edge[] = [];
  const collect = (w: WBPFlat & { dependenciesFrom?: Array<{ id: string; fromWbpId: string; toWbpId: string; type: string; status: string }> }) => {
    if (w.dependenciesFrom) {
      for (const d of w.dependenciesFrom) {
        edges.push({
          id: d.id,
          from: d.fromWbpId,
          to: d.toWbpId,
          type: d.type,
          status: d.status,
        });
      }
    }
    w.children?.forEach(collect);
  };
  wbps.forEach(collect);
  return edges;
}

export default function DependenciesView() {
  const { locale } = useAppStore();
  const { t } = useTranslation(locale);
  const [data, setData] = useState<ProgramDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch('/api/program')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as FlatWBP[], edges: [] as Edge[] };
    const flatWbps = flattenWbps(data.wbps);
    const deps = flattenDeps(data.wbps);

    const cols = 4;
    const gapX = 280;
    const gapY = 140;

    flatWbps.forEach((wbp, i) => {
      wbp.x = (i % cols) * gapX + 40;
      wbp.y = Math.floor(i / cols) * gapY + 40;
    });

    return { nodes: flatWbps, edges: deps };
  }, [data]);

  const validEdges = useMemo(
    () => edges.filter((e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to)),
    [edges, nodes],
  );

  const highlightedIds = useMemo(() => {
    const ids = new Set<string>();
    const activeId = hoveredId || selectedId;
    if (!activeId) return ids;
    ids.add(activeId);
    for (const e of validEdges) {
      if (e.from === activeId || e.to === activeId) {
        ids.add(e.from);
        ids.add(e.to);
      }
    }
    return ids;
  }, [hoveredId, selectedId, validEdges]);

  const getNodeById = useCallback(
    (id: string) => nodes.find((n) => n.id === id),
    [nodes],
  );

  const svgW = nodes.length > 0 ? Math.max(...nodes.map((n) => n.x)) + 300 : 800;
  const svgH = nodes.length > 0 ? Math.max(...nodes.map((n) => n.y)) + 200 : 500;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-xcollab-surface-2" />
        <Skeleton className="h-[500px] bg-xcollab-surface-2 rounded-xl" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="empty-state-icon">
          <ArrowRightLeft className="w-8 h-8 text-[#71717A]" />
        </div>
        <p className="text-sm text-[#71717A]">{t('dependencies.noDependencies')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1.5 h-6 bg-[#FF4713] rounded-full" />
        <ArrowRightLeft className="w-5 h-5 text-[#FF4713]" />
        <h2 className="text-xl font-bold text-[#E8E8ED]">{t('dependencies.title')}</h2>
        <Badge variant="outline" className="text-[11px] ms-2 border-xcollab-border/60 text-[#71717A]">
          {validEdges.length} {t('dependencies.title').toLowerCase()}
        </Badge>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-6 text-xs text-[#71717A]">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0 border-t-2 border-[#EF4444]" />
          <span>{t('dependencies.blocks')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0 border-t-2 border-dashed border-[#71717A]" />
          <span>{t('dependencies.relatesTo')}</span>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="relative" style={{ minWidth: svgW, minHeight: svgH }}>
          {/* SVG overlay for connections */}
          <svg
            ref={svgRef}
            className="absolute inset-0 pointer-events-none"
            width={svgW}
            height={svgH}
            style={{ zIndex: 1 }}
          >
            <defs>
              <marker id="arrowhead-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#EF4444" />
              </marker>
              <marker id="arrowhead-gray" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#71717A" />
              </marker>
            </defs>

            {validEdges.map((edge) => {
              const fromNode = getNodeById(edge.from);
              const toNode = getNodeById(edge.to);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.x + 240;
              const y1 = fromNode.y + 50;
              const x2 = toNode.x;
              const y2 = toNode.y + 50;

              const isHighlighted =
                highlightedIds.has(edge.from) && highlightedIds.has(edge.to);
              const isBlocks = edge.type === 'blocks';

              const midX = (x1 + x2) / 2;
              const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

              return (
                <path
                  key={edge.id}
                  d={path}
                  fill="none"
                  stroke={isBlocks ? '#EF4444' : '#71717A'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isBlocks ? 'none' : '6 4'}
                  markerEnd={isBlocks ? 'url(#arrowhead-red)' : 'url(#arrowhead-gray)'}
                  opacity={highlightedIds.size > 0 ? (isHighlighted ? 1 : 0.15) : 0.6}
                  className="transition-opacity"
                />
              );
            })}
          </svg>

          {/* Node cards */}
          <div className="relative" style={{ zIndex: 2 }}>
            {nodes.map((node) => {
              const isHighlighted = highlightedIds.size === 0 || highlightedIds.has(node.id);
              return (
                <motion.div
                  key={node.id}
                  className="absolute"
                  style={{ left: node.x, top: node.y, width: 240 }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId(selectedId === node.id ? null : node.id)}
                  whileHover={{ scale: 1.03, zIndex: 10 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Card
                    className={`cursor-pointer transition-all rounded-xl border card-glass ${
                      selectedId === node.id
                        ? 'border-[#FF4713]/50 glow-orange-sm'
                        : 'border-xcollab-border/40 hover:border-xcollab-border/80'
                    }`}
                    style={{
                      opacity: highlightedIds.size > 0 ? (isHighlighted ? 1 : 0.2) : 1,
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{
                            backgroundColor: HEALTH_COLORS[node.health] || '#71717A',
                            boxShadow: `0 0 8px ${HEALTH_COLORS[node.health] || '#71717A'}40`,
                          }}
                        />
                        <span className="text-[11px] font-mono text-[#71717A]">{node.code}</span>
                        <div className="ms-auto">
                          <span
                            className="w-2.5 h-2.5 rounded-full block"
                            style={{ backgroundColor: node.teamColor }}
                          />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-[#B0B0C0] line-clamp-2 leading-snug">
                        {node.name}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
