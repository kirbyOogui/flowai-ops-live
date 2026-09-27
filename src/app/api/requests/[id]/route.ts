import { requireAdmin } from "@/lib/auth/session";
import { readJson, toErrorResponse } from "@/lib/http";
import { requestPatchSchema, updateRequest } from "@/lib/services/requests";

export async function PATCH(request: Request, ctx: RouteContext<"/api/requests/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const patch = requestPatchSchema.parse(await readJson(request));
    return Response.json({ request: await updateRequest(id, patch) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
