"use client";

import { Sparkles } from "lucide-react";
import type { ReactElement } from "react";
import type { Program } from "@xcollab/core";
import { listUsers, type WorkspaceUser } from "../../lib/api-client.ts";
import { buildWelcome, countOpenTasks, resolveFirstName } from "../../lib/assistant-welcome.ts";
import { useAuth } from "../../lib/auth-context.tsx";
import { useUi } from "../../lib/ui-context.tsx";
import { useWorkspaceData } from "../../lib/use-workspace-data.ts";
import { Icon } from "../ui/icon.tsx";

/** Module-level so useWorkspaceData sees a stable fetcher identity. */
function fetchUsers(base: string, workspaceId: string): Promise<WorkspaceUser[]> {
  return listUsers(base, { workspaceId });
}

interface AssistantWelcomeProps {
  /** Workspace programs already loaded by AssistantChat (null while loading). */
  programs: Program[] | null;
  /** Sends the clicked example verbatim as a chat message. */
  onPick: (text: string) => void;
}

/** Personalized empty-transcript welcome (fix-wave-M) — client-composed, no
    model call, rendered in both the /ai page and the floating panel. */
export function AssistantWelcome({ programs, onPick }: AssistantWelcomeProps): ReactElement {
  const { t } = useUi();
  const { user } = useAuth();
  const { data: users } = useWorkspaceData(fetchUsers);
  const profile = user ?? { username: "", fullName: "" };
  const content = buildWelcome(t, {
    firstName: resolveFirstName(profile, users),
    openTasks: countOpenTasks(programs ?? [], profile.username),
    projectName: programs?.[0]?.name ?? null,
  });
  return (
    <div className="xai-welcome">
      <span className="s2-ai-glyph" aria-hidden>
        <Icon icon={Sparkles} size={24} />
      </span>
      <h3 className="xai-welcome-greeting">{content.greeting}</h3>
      <p className="xai-welcome-intro">{content.intro}</p>
      <h4 className="xai-welcome-cando">{content.canDo}</h4>
      {content.sections.map((section) => (
        <section key={section.title} className="xai-welcome-section">
          <h5>{section.title}</h5>
          <p>{section.body}</p>
          <div className="xai-welcome-examples">
            {section.examples.map((example) => (
              <button
                key={example}
                type="button"
                className="xai-suggestion"
                onClick={() => onPick(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </section>
      ))}
      <p className="xai-welcome-tip">
        <strong>{content.tipTitle}:</strong> {content.tipBody}
      </p>
    </div>
  );
}
