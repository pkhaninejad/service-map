import type { Service } from "./schema";

export type Filters = {
  areas: Set<string>;
  kinds: Set<string>;
  statuses: Set<string>;
  techs: Set<string>;
  developedBy: Set<string>;
  maintainedBy: Set<string>;
};

export function emptyFilters(): Filters {
  return {
    areas: new Set(),
    kinds: new Set(),
    statuses: new Set(),
    techs: new Set(),
    developedBy: new Set(),
    maintainedBy: new Set(),
  };
}

export function isFilterEmpty(f: Filters): boolean {
  return (
    f.areas.size === 0 &&
    f.kinds.size === 0 &&
    f.statuses.size === 0 &&
    f.techs.size === 0 &&
    f.developedBy.size === 0 &&
    f.maintainedBy.size === 0
  );
}

export function activeFilterCount(f: Filters): number {
  return (
    f.areas.size +
    f.kinds.size +
    f.statuses.size +
    f.techs.size +
    f.developedBy.size +
    f.maintainedBy.size
  );
}

function hasAnyMatch(values: string[], selected: Set<string>): boolean {
  return values.some((value) => selected.has(value));
}

export function getMaintainedByTeams(service: Service): string[] {
  if (service.maintainedBy.length > 0) return service.maintainedBy;
  const fallback = service.maintainerTeam ?? service.owner;
  return fallback ? [fallback] : [];
}

export function getDevelopedByTeams(service: Service): string[] {
  if (service.developedBy.length > 0) return service.developedBy;
  // If no explicit developer team is set, mirror maintainer info as a fallback.
  return getMaintainedByTeams(service);
}

export function matchesFilters(
  service: Service,
  filters: Filters,
  query: string,
): boolean {
  if (filters.areas.size > 0 && !filters.areas.has(service.area)) return false;
  if (filters.kinds.size > 0 && !filters.kinds.has(service.kind)) return false;
  if (
    filters.statuses.size > 0 &&
    !filters.statuses.has(service.status ?? "")
  )
    return false;
  if (
    filters.techs.size > 0 &&
    !service.tech.some((t) => filters.techs.has(t))
  )
    return false;
  if (
    filters.developedBy.size > 0 &&
    !hasAnyMatch(getDevelopedByTeams(service), filters.developedBy)
  )
    return false;
  if (
    filters.maintainedBy.size > 0 &&
    !hasAnyMatch(getMaintainedByTeams(service), filters.maintainedBy)
  )
    return false;

  const q = query.trim().toLowerCase();
  if (q) {
    const haystack = [
      service.name,
      service.summary ?? "",
      service.area,
      service.kind,
      service.runtime ?? "",
      ...service.tech,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}

export function collectTechs(services: Service[]): string[] {
  const set = new Set<string>();
  for (const s of services) {
    for (const t of s.tech) set.add(t);
  }
  return Array.from(set).sort();
}

export function collectStatuses(services: Service[]): string[] {
  const set = new Set<string>();
  for (const s of services) {
    if (s.status) set.add(s.status);
  }
  return Array.from(set).sort();
}

export function collectDeveloperTeams(services: Service[]): string[] {
  const set = new Set<string>();
  for (const s of services) {
    const teams = getDevelopedByTeams(s);
    for (const team of teams) {
      if (team) set.add(team);
    }
  }
  return Array.from(set).sort();
}

export function collectMaintainerTeams(services: Service[]): string[] {
  const set = new Set<string>();
  for (const s of services) {
    const teams = getMaintainedByTeams(s);
    for (const team of teams) {
      if (team) set.add(team);
    }
  }
  return Array.from(set).sort();
}
