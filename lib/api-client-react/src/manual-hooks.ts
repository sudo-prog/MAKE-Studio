/**
 * Manual API hooks for community & integration endpoints (Task 2).
 * Follow the same customFetch + react-query pattern as the generated api.ts.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  MutationFunction,
  QueryFunction,
  UseMutationOptions,
  UseQueryOptions,
  QueryKey,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

type Awaited<O> = O extends PromiseLike<infer T> ? T : O;

// ── Types ────────────────────────────────────────────────────────────────────

export interface GitHubStatus {
  connected: boolean;
  login?: string;
}

export interface GitHubPushResult {
  ok: boolean;
  repoUrl: string;
  pushedFiles: string[];
}

export interface OctoPrintStatus {
  connected: boolean;
  octoprintUrl?: string;
  version?: string;
  job?: unknown;
  printer?: unknown;
}

export interface MakerspaceResult {
  zip: string;
  spaces: { name: string; address: string; distance: string; services: string[]; website: string }[];
}

export interface ForkResult {
  id: number;
  title: string;
  sourceId: number;
}

export interface ProjectVersion {
  id: number;
  projectId: number;
  userId: number;
  versionNumber: number;
  prompt?: string;
  diffSummary?: string;
  snapshot?: unknown;
  createdAt: string;
}

export interface ShowcasePost {
  id: number;
  projectId: number;
  userId: number;
  caption?: string;
  mediaUrl?: string;
  mediaType?: string;
  likeCount: number;
  commentCount: number;
  makerVerified: boolean;
  createdAt: string;
  projectTitle?: string;
  projectCategory?: string;
  userDisplayName?: string;
}

export interface ShowcaseList {
  items: ShowcasePost[];
  total: number;
  page: number;
  limit: number;
}

export interface ShowcaseComment {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  userDisplayName?: string;
}

export interface Challenge {
  id: number;
  title: string;
  description: string;
  theme?: string;
  prize?: string;
  startsAt: string;
  endsAt?: string;
  isActive: boolean;
  submissionCount: number;
  winnerId?: number;
  createdAt: string;
}

export interface ChallengeSubmission {
  id: number;
  challengeId: number;
  projectId: number;
  userId: number;
  note?: string;
  isWinner: boolean;
  createdAt: string;
  projectTitle?: string;
  projectCategory?: string;
  userDisplayName?: string;
}

export interface AffiliateEarnings {
  totalClicks: number;
  estimatedCommissions: string;
  bySupplier: { supplier: string; clicks: number; estimatedCommission: number }[];
  topParts: { partName?: string; supplier: string; clicks: number }[];
}

export interface AdminAnalytics {
  totalUsers: number;
  totalProjects: number;
  readyProjects: number;
  generationsToday: number;
  totalAffiliateClicks: number;
  topProjects: { id: number; title: string; category?: string }[];
  conversionFunnel: Record<string, number>;
  clicksBySupplier: { supplier: string; count: number }[];
}

// ── GitHub ───────────────────────────────────────────────────────────────────

export const getGitHubStatus = async (): Promise<GitHubStatus> =>
  customFetch<GitHubStatus>("/api/integrations/github/status");

export const getGitHubStatusQueryKey = () => ["/api/integrations/github/status"] as const;

export function useGitHubStatus<TData = GitHubStatus, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<GitHubStatus, TError, TData>; request?: RequestInit },
) {
  const { query: queryOptions } = options ?? {};
  return useQuery<GitHubStatus, TError, TData>({
    queryKey: getGitHubStatusQueryKey(),
    queryFn: getGitHubStatus,
    ...queryOptions,
  } as UseQueryOptions<GitHubStatus, TError, TData>);
}

export const githubDisconnect = async (): Promise<{ ok: boolean }> =>
  customFetch("/api/integrations/github/disconnect", { method: "POST" });

export function useGitHubDisconnect<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<{ ok: boolean }, TError, void> },
) {
  const mutationFn: MutationFunction<{ ok: boolean }, void> = () => githubDisconnect();
  return useMutation<{ ok: boolean }, TError, void>({ mutationFn, ...options?.mutation });
}

export const githubPush = async (data: { projectId: number; repoName?: string; createNew?: boolean }): Promise<GitHubPushResult> =>
  customFetch("/api/integrations/github/push", { method: "POST", body: JSON.stringify(data) });

export function useGitHubPush<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<GitHubPushResult, TError, { projectId: number; repoName?: string; createNew?: boolean }> },
) {
  const mutationFn: MutationFunction<GitHubPushResult, { projectId: number; repoName?: string; createNew?: boolean }> = (data) => githubPush(data);
  return useMutation<GitHubPushResult, TError, { projectId: number; repoName?: string; createNew?: boolean }>({ mutationFn, ...options?.mutation });
}

// ── OctoPrint ─────────────────────────────────────────────────────────────────

export const getOctoPrintStatus = async (): Promise<OctoPrintStatus> =>
  customFetch<OctoPrintStatus>("/api/integrations/octoprint/status");

export const getOctoPrintStatusQueryKey = () => ["/api/integrations/octoprint/status"] as const;

export function useOctoPrintStatus<TData = OctoPrintStatus, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<OctoPrintStatus, TError, TData>; request?: RequestInit },
) {
  const { query: queryOptions } = options ?? {};
  return useQuery<OctoPrintStatus, TError, TData>({
    queryKey: getOctoPrintStatusQueryKey(),
    queryFn: getOctoPrintStatus,
    ...queryOptions,
  } as UseQueryOptions<OctoPrintStatus, TError, TData>);
}

export const octoprintConnect = async (data: { octoprintUrl: string; apiKey: string }): Promise<{ ok: boolean }> =>
  customFetch("/api/integrations/octoprint/connect", { method: "POST", body: JSON.stringify(data) });

export function useOctoPrintConnect<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<{ ok: boolean }, TError, { octoprintUrl: string; apiKey: string }> },
) {
  const mutationFn: MutationFunction<{ ok: boolean }, { octoprintUrl: string; apiKey: string }> = (data) => octoprintConnect(data);
  return useMutation<{ ok: boolean }, TError, { octoprintUrl: string; apiKey: string }>({ mutationFn, ...options?.mutation });
}

// ── Makerspace Search ─────────────────────────────────────────────────────────

export const searchMakerspaces = async (zip: string): Promise<MakerspaceResult> =>
  customFetch<MakerspaceResult>(`/api/integrations/makerspace-search?zip=${encodeURIComponent(zip)}`);

export const getSearchMakerspacesQueryKey = (zip: string) => ["/api/integrations/makerspace-search", zip] as const;

export function useSearchMakerspaces<TData = MakerspaceResult, TError = ErrorType<unknown>>(
  zip: string,
  options?: { query?: UseQueryOptions<MakerspaceResult, TError, TData> },
) {
  return useQuery<MakerspaceResult, TError, TData>({
    queryKey: getSearchMakerspacesQueryKey(zip),
    queryFn: () => searchMakerspaces(zip),
    enabled: zip.length >= 3,
    ...options?.query,
  } as UseQueryOptions<MakerspaceResult, TError, TData>);
}

// ── Fork / Remix ──────────────────────────────────────────────────────────────

export const forkProject = async (id: number): Promise<ForkResult> =>
  customFetch<ForkResult>(`/api/projects/${id}/fork`, { method: "POST" });

export function useForkProject<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<ForkResult, TError, number> },
) {
  const mutationFn: MutationFunction<ForkResult, number> = (id) => forkProject(id);
  return useMutation<ForkResult, TError, number>({ mutationFn, ...options?.mutation });
}

// ── Project Like ──────────────────────────────────────────────────────────────

export const toggleProjectLike = async (id: number): Promise<{ liked: boolean }> =>
  customFetch<{ liked: boolean }>(`/api/projects/${id}/like`, { method: "POST" });

export function useToggleProjectLike<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<{ liked: boolean }, TError, number> },
) {
  const mutationFn: MutationFunction<{ liked: boolean }, number> = (id) => toggleProjectLike(id);
  return useMutation<{ liked: boolean }, TError, number>({ mutationFn, ...options?.mutation });
}

// ── Version History ───────────────────────────────────────────────────────────

export const getProjectVersions = async (id: number): Promise<ProjectVersion[]> =>
  customFetch<ProjectVersion[]>(`/api/projects/${id}/versions`);

export const getProjectVersionsQueryKey = (id: number) => ["/api/projects/versions", id] as const;

export function useProjectVersions<TData = ProjectVersion[], TError = ErrorType<unknown>>(
  id: number,
  options?: { query?: UseQueryOptions<ProjectVersion[], TError, TData> },
) {
  return useQuery<ProjectVersion[], TError, TData>({
    queryKey: getProjectVersionsQueryKey(id),
    queryFn: () => getProjectVersions(id),
    enabled: id > 0,
    ...options?.query,
  } as UseQueryOptions<ProjectVersion[], TError, TData>);
}

export const snapshotProjectVersion = async (id: number, diffSummary?: string): Promise<ProjectVersion> =>
  customFetch<ProjectVersion>(`/api/projects/${id}/versions`, { method: "POST", body: JSON.stringify({ diffSummary }) });

export function useSnapshotVersion<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<ProjectVersion, TError, { id: number; diffSummary?: string }> },
) {
  const mutationFn: MutationFunction<ProjectVersion, { id: number; diffSummary?: string }> = ({ id, diffSummary }) => snapshotProjectVersion(id, diffSummary);
  return useMutation<ProjectVersion, TError, { id: number; diffSummary?: string }>({ mutationFn, ...options?.mutation });
}

export const restoreVersion = async (projectId: number, versionId: number): Promise<{ ok: boolean; restoredTo: number }> =>
  customFetch(`/api/projects/${projectId}/versions/${versionId}/restore`, { method: "POST" });

export function useRestoreVersion<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<{ ok: boolean; restoredTo: number }, TError, { projectId: number; versionId: number }> },
) {
  const mutationFn: MutationFunction<{ ok: boolean; restoredTo: number }, { projectId: number; versionId: number }> =
    ({ projectId, versionId }) => restoreVersion(projectId, versionId);
  return useMutation<{ ok: boolean; restoredTo: number }, TError, { projectId: number; versionId: number }>({ mutationFn, ...options?.mutation });
}

// ── Showcase ──────────────────────────────────────────────────────────────────

export const getShowcase = async (params?: { sort?: string; page?: number }): Promise<ShowcaseList> => {
  const q = new URLSearchParams();
  if (params?.sort) q.set("sort", params.sort);
  if (params?.page) q.set("page", String(params.page));
  return customFetch<ShowcaseList>(`/api/showcase?${q.toString()}`);
};

export const getShowcaseQueryKey = (params?: { sort?: string; page?: number }) =>
  ["/api/showcase", params] as const;

export function useShowcase<TData = ShowcaseList, TError = ErrorType<unknown>>(
  params?: { sort?: string; page?: number },
  options?: { query?: UseQueryOptions<ShowcaseList, TError, TData> },
) {
  return useQuery<ShowcaseList, TError, TData>({
    queryKey: getShowcaseQueryKey(params),
    queryFn: () => getShowcase(params),
    ...options?.query,
  } as UseQueryOptions<ShowcaseList, TError, TData>);
}

export const createShowcasePost = async (data: { projectId: number; caption?: string; mediaUrl?: string; mediaType?: string }): Promise<ShowcasePost> =>
  customFetch<ShowcasePost>("/api/showcase", { method: "POST", body: JSON.stringify(data) });

export function useCreateShowcasePost<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<ShowcasePost, TError, { projectId: number; caption?: string; mediaUrl?: string; mediaType?: string }> },
) {
  const mutationFn: MutationFunction<ShowcasePost, { projectId: number; caption?: string; mediaUrl?: string; mediaType?: string }> =
    (data) => createShowcasePost(data);
  return useMutation<ShowcasePost, TError, { projectId: number; caption?: string; mediaUrl?: string; mediaType?: string }>({ mutationFn, ...options?.mutation });
}

export const toggleShowcaseLike = async (id: number): Promise<{ liked: boolean }> =>
  customFetch<{ liked: boolean }>(`/api/showcase/${id}/like`, { method: "POST" });

export function useToggleShowcaseLike<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<{ liked: boolean }, TError, number> },
) {
  const mutationFn: MutationFunction<{ liked: boolean }, number> = (id) => toggleShowcaseLike(id);
  return useMutation<{ liked: boolean }, TError, number>({ mutationFn, ...options?.mutation });
}

export const getShowcaseComments = async (id: number): Promise<ShowcaseComment[]> =>
  customFetch<ShowcaseComment[]>(`/api/showcase/${id}/comments`);

export const getShowcaseCommentsQueryKey = (id: number) => ["/api/showcase/comments", id] as const;

export function useShowcaseComments<TData = ShowcaseComment[], TError = ErrorType<unknown>>(
  id: number,
  options?: { query?: UseQueryOptions<ShowcaseComment[], TError, TData> },
) {
  return useQuery<ShowcaseComment[], TError, TData>({
    queryKey: getShowcaseCommentsQueryKey(id),
    queryFn: () => getShowcaseComments(id),
    enabled: id > 0,
    ...options?.query,
  } as UseQueryOptions<ShowcaseComment[], TError, TData>);
}

export const addShowcaseComment = async (id: number, content: string): Promise<ShowcaseComment> =>
  customFetch<ShowcaseComment>(`/api/showcase/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) });

export function useAddShowcaseComment<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<ShowcaseComment, TError, { id: number; content: string }> },
) {
  const mutationFn: MutationFunction<ShowcaseComment, { id: number; content: string }> =
    ({ id, content }) => addShowcaseComment(id, content);
  return useMutation<ShowcaseComment, TError, { id: number; content: string }>({ mutationFn, ...options?.mutation });
}

// ── Challenges ────────────────────────────────────────────────────────────────

export const getChallenges = async (): Promise<Challenge[]> =>
  customFetch<Challenge[]>("/api/challenges");

export const getChallengesQueryKey = () => ["/api/challenges"] as const;

export function useChallenges<TData = Challenge[], TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<Challenge[], TError, TData> },
) {
  return useQuery<Challenge[], TError, TData>({
    queryKey: getChallengesQueryKey(),
    queryFn: getChallenges,
    ...options?.query,
  } as UseQueryOptions<Challenge[], TError, TData>);
}

export const getChallengeSubmissions = async (id: number): Promise<ChallengeSubmission[]> =>
  customFetch<ChallengeSubmission[]>(`/api/challenges/${id}/submissions`);

export const getChallengeSubmissionsQueryKey = (id: number) => ["/api/challenges/submissions", id] as const;

export function useChallengeSubmissions<TData = ChallengeSubmission[], TError = ErrorType<unknown>>(
  id: number,
  options?: { query?: UseQueryOptions<ChallengeSubmission[], TError, TData> },
) {
  return useQuery<ChallengeSubmission[], TError, TData>({
    queryKey: getChallengeSubmissionsQueryKey(id),
    queryFn: () => getChallengeSubmissions(id),
    enabled: id > 0,
    ...options?.query,
  } as UseQueryOptions<ChallengeSubmission[], TError, TData>);
}

export const submitToChallenge = async (id: number, data: { projectId: number; note?: string }): Promise<ChallengeSubmission> =>
  customFetch<ChallengeSubmission>(`/api/challenges/${id}/submit`, { method: "POST", body: JSON.stringify(data) });

export function useSubmitToChallenge<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<ChallengeSubmission, TError, { id: number; projectId: number; note?: string }> },
) {
  const mutationFn: MutationFunction<ChallengeSubmission, { id: number; projectId: number; note?: string }> =
    ({ id, ...data }) => submitToChallenge(id, data);
  return useMutation<ChallengeSubmission, TError, { id: number; projectId: number; note?: string }>({ mutationFn, ...options?.mutation });
}

export const createChallenge = async (data: { title: string; description: string; theme?: string; prize?: string; endsAt?: string }): Promise<Challenge> =>
  customFetch<Challenge>("/api/challenges", { method: "POST", body: JSON.stringify(data) });

export function useCreateChallenge<TError = ErrorType<unknown>>(
  options?: { mutation?: UseMutationOptions<Challenge, TError, { title: string; description: string; theme?: string; prize?: string; endsAt?: string }> },
) {
  const mutationFn: MutationFunction<Challenge, { title: string; description: string; theme?: string; prize?: string; endsAt?: string }> =
    (data) => createChallenge(data);
  return useMutation<Challenge, TError, { title: string; description: string; theme?: string; prize?: string; endsAt?: string }>({ mutationFn, ...options?.mutation });
}

// ── Affiliate Earnings ────────────────────────────────────────────────────────

export const getAffiliateEarnings = async (): Promise<AffiliateEarnings> =>
  customFetch<AffiliateEarnings>("/api/affiliate/earnings");

export const getAffiliateEarningsQueryKey = () => ["/api/affiliate/earnings"] as const;

export function useAffiliateEarnings<TData = AffiliateEarnings, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<AffiliateEarnings, TError, TData> },
) {
  return useQuery<AffiliateEarnings, TError, TData>({
    queryKey: getAffiliateEarningsQueryKey(),
    queryFn: getAffiliateEarnings,
    ...options?.query,
  } as UseQueryOptions<AffiliateEarnings, TError, TData>);
}

// ── Admin Analytics ───────────────────────────────────────────────────────────

export const getAdminAnalytics = async (): Promise<AdminAnalytics> =>
  customFetch<AdminAnalytics>("/api/admin/analytics");

export const getAdminAnalyticsQueryKey = () => ["/api/admin/analytics"] as const;

export function useAdminAnalytics<TData = AdminAnalytics, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<AdminAnalytics, TError, TData> },
) {
  return useQuery<AdminAnalytics, TError, TData>({
    queryKey: getAdminAnalyticsQueryKey(),
    queryFn: getAdminAnalytics,
    ...options?.query,
  } as UseQueryOptions<AdminAnalytics, TError, TData>);
}
