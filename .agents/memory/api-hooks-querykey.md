---
name: API hooks queryKey pattern
description: Orval-generated hooks require queryKey in UseQueryOptions — how to call them correctly
---

# API Hooks QueryKey Pattern

## Rule
Orval-generated hooks (in `lib/api-client-react/src/generated/api.ts`) require `queryKey` as part of `UseQueryOptions`. Always pass the matching query key helper:

```typescript
// CORRECT
const params = { page, limit, search };
const { data } = useListProjects(params, {
  query: { queryKey: getListProjectsQueryKey(params) }
});

// ALSO CORRECT — with conditional enabled
const { data } = useGetMe({
  query: { queryKey: getGetMeQueryKey(), enabled: !!isSignedIn }
});

// WRONG — TypeScript error: queryKey missing
const { data } = useListProjects(params, { query: { enabled: true } });
```

**Why:** orval generates strict `UseQueryOptions` types from @tanstack/react-query v5 where `queryKey` is required.

**How to apply:** In every page/component that calls a generated query hook with custom options. If `enabled: true` (the default), you can omit options entirely. Only pass options when you need `enabled` or other non-default behavior.
