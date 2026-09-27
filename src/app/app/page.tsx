import type { Metadata } from "next";
import { Workspace } from "@/components/flow/workspace";
import { VIEWS, type View } from "@/components/flow/shell";
import { getAiInfo } from "@/lib/ai";
import { requireAdminPage } from "@/lib/auth/session";
import { gmailStatus } from "@/lib/channels/gmail";
import { slackStatus } from "@/lib/channels/slack";
import { todayISO } from "@/lib/dates";
import { listInboundIssues, listMembers, listRequests } from "@/lib/services/requests";

export const metadata: Metadata = { title: "ダッシュボード — FlowAI OPS", robots: { index: false } };

/** オーナー専用のダッシュボード（受信した依頼の一覧・詳細・返信） */
export default async function AppPage(props: PageProps<"/app">) {
  await requireAdminPage("/app");
  const { view } = await props.searchParams;
  const initialView: View = typeof view === "string" && (VIEWS as readonly string[]).includes(view) ? (view as View) : "home";

  const [requests, inbound, members, gmail, slack] = await Promise.all([
    listRequests(),
    listInboundIssues(),
    listMembers(),
    gmailStatus(),
    slackStatus(),
  ]);

  return (
    <Workspace
      initialRequests={requests}
      initialInbound={inbound}
      initialIntegrations={{
        gmail,
        slack: { ...slack, channelId: process.env.SLACK_CHANNEL_ID || null },
        formUrl: `${process.env.APP_URL?.replace(/\/$/, "") ?? ""}/form`,
      }}
      initialView={initialView}
      members={members}
      today={todayISO()}
      aiInfo={getAiInfo()}
    />
  );
}
