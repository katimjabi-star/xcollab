"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, listPrograms } from "../../../lib/api-client.ts";
import { useUi } from "../../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../../lib/use-workspace-data.ts";
import { ProgramView } from "../../../components/program-view.tsx";

export default function ProgramDetailPage() {
  const { t, language, dir } = useUi();
  const { id } = useParams<{ id: string }>();
  const { data, error, loaded } = useWorkspaceData(listPrograms);
  const program = data?.find((p) => p.id === id) ?? null;

  return (
    <div className="content">
      <Link className="back-link" href="/programs">
        <span aria-hidden>{dir === "rtl" ? "→" : "←"}</span> {t.backToPrograms}
      </Link>

      {error ? (
        <p className="error-note" role="alert">
          {t.errorGeneric}
          {error instanceof ApiError ? ` (${error.message})` : ""}
        </p>
      ) : null}

      {loaded && !error && !program ? <p className="empty">{t.notFound}</p> : null}

      {program ? <ProgramView program={program} uiLanguage={language} detail /> : null}
    </div>
  );
}
