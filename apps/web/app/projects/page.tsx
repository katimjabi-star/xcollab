"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CornerDownRight } from "lucide-react";
import type { Program } from "@xcollab/core";
import { ApiError, listPrograms } from "../../lib/api-client.ts";
import { STRINGS } from "../../lib/i18n.ts";
import { setDocumentTitle } from "../../lib/nav.ts";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import { ProgramCard } from "../../components/program-view.tsx";
import { programDisplayName } from "../../lib/program-format.ts";
import { Icon } from "../../components/ui/icon.tsx";
import { Skeleton } from "../../components/ui/skeleton.tsx";

type Strings = (typeof STRINGS)["en"];

/** Skeletons appear only once loading has visibly taken longer than 300ms. */
function useSkeletonGate(loaded: boolean): boolean {
  const [pastDelay, setPastDelay] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setPastDelay(true), 300);
    return () => clearTimeout(id);
  }, []);
  return pastDelay && !loaded;
}

function ProgramsSkeleton({ label }: { label: string }) {
  return (
    <div className="programs-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div className="program-tile" key={i}>
          <div className="program-tile-head">
            <Skeleton width="70%" height="13px" label={i === 0 ? label : undefined} />
            <Skeleton width="28px" height="20px" radius="999px" />
          </div>
          <Skeleton width="100%" height="12px" />
          <Skeleton width="55%" height="12px" />
        </div>
      ))}
    </div>
  );
}

/** Compact indented sub-program rows under a parent card. Recursion is safe:
    each program has one parent, so a child link chain can never revisit a node. */
function SubProgramRows({
  parentId,
  byParent,
  depth,
  t,
}: {
  parentId: string;
  byParent: Map<string, Program[]>;
  depth: number;
  t: Strings;
}) {
  const children = byParent.get(parentId);
  if (!children || children.length === 0) return null;
  return (
    <ul className="subprogram-rows" aria-label={depth === 0 ? t.subProgramsLabel : undefined}>
      {children.map((program) => {
        const taskCount = program.packages.reduce((n, pkg) => n + pkg.tasks.length, 0);
        return (
          <li key={program.id}>
            <Link
              className="subprogram-row"
              href={`/projects/${program.id}`}
              style={{ paddingInlineStart: `calc(var(--space-2) + ${depth} * var(--space-4))` }}
            >
              <Icon icon={CornerDownRight} size={14} directional />
              <span className="subprogram-name" dir="auto">
                {programDisplayName(program)}
              </span>
              <span className="subprogram-count num">
                {taskCount} {t.tasksLabel}
              </span>
            </Link>
            <SubProgramRows parentId={program.id} byParent={byParent} depth={depth + 1} t={t} />
          </li>
        );
      })}
    </ul>
  );
}

export default function ProgramsPage() {
  const { t, language } = useUi();
  // Re-assert the list title: detail → list keeps the same route label, so
  // the shell's label-keyed effect won't clear a stale program title.
  useEffect(() => {
    setDocumentTitle([t.navPrograms]);
  }, [t.navPrograms]);
  const { data, error, loaded } = useWorkspaceData(listPrograms);
  const programs = data ? [...data].reverse() : [];
  const showSkeleton = useSkeletonGate(loaded);

  // Tree shape: roots are programs without a parentId — or with a parentId
  // that isn't in the workspace (orphans render honestly as roots).
  const ids = new Set(programs.map((program) => program.id));
  const roots = programs.filter((program) => !program.parentId || !ids.has(program.parentId));
  const byParent = new Map<string, Program[]>();
  for (const program of programs) {
    if (program.parentId && ids.has(program.parentId)) {
      const siblings = byParent.get(program.parentId) ?? [];
      siblings.push(program);
      byParent.set(program.parentId, siblings);
    }
  }

  return (
    <div className="content">
      {error ? (
        <p className="error-note" role="alert">
          {t.errorGeneric}
          {error instanceof ApiError ? ` (${error.message})` : ""}
        </p>
      ) : null}

      {showSkeleton && !error ? <ProgramsSkeleton label={t.skeletonLoading} /> : null}

      {loaded && !error && programs.length === 0 ? (
        <p className="empty">{t.emptyState}</p>
      ) : null}

      {roots.length > 0 ? (
        <div className="programs-grid">
          {/* Sub-projects render INSIDE the parent card as an indented section
              under a hairline (audit #10) — never as floating gutter rows.
              Parents with children carry the card chrome on the wrapper. */}
          {roots.map((program) => {
            const hasChildren = byParent.has(program.id);
            return (
              <div
                key={program.id}
                className={`program-tree-item${hasChildren ? " has-children" : ""}`}
              >
                <Link className="card-link" href={`/projects/${program.id}`}>
                  <ProgramCard program={program} uiLanguage={language} />
                </Link>
                {hasChildren ? (
                  <SubProgramRows parentId={program.id} byParent={byParent} depth={0} t={t} />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
