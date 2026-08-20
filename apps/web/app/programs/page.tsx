"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, listPrograms } from "../../lib/api-client.ts";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import { ProgramCard } from "../../components/program-view.tsx";
import { Skeleton } from "../../components/ui/skeleton.tsx";

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

export default function ProgramsPage() {
  const { t, language } = useUi();
  const { data, error, loaded } = useWorkspaceData(listPrograms);
  const programs = data ? [...data].reverse() : [];
  const showSkeleton = useSkeletonGate(loaded);

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

      {programs.length > 0 ? (
        <div className="programs-grid">
          {programs.map((program) => (
            <Link key={program.id} className="card-link" href={`/programs/${program.id}`}>
              <ProgramCard program={program} uiLanguage={language} />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
