import type { RouteData } from "common";

function isStandaloneTravel(step: RouteData.FragmentStep, areaId: string) {
  if (step.subSteps.length > 0) return false;

  let destinations = 0;
  for (const part of step.parts) {
    if (typeof part === "string") {
      if (!/^[\s\u279e\u2192]*$/u.test(part)) return false;
      continue;
    }

    switch (part.type) {
      case "enter":
        if (part.areaId !== areaId) return false;
        break;
      case "waypoint_use":
      case "portal_use":
        if (part.dstAreaId !== areaId) return false;
        break;
      default:
        return false;
    }
    destinations++;
  }

  return destinations === 1;
}

export function getAutoProgressTransition(
  route: RouteData.Route,
  activeEdgeIndex: number,
  message: string,
) {
  const areaId = /Generating level \d+ area "([^"]+)"/.exec(message)?.[1];
  const edgeIndex = activeEdgeIndex + 1;
  if (areaId === undefined || route.edges[edgeIndex] !== areaId) return null;

  let completionKey: string | null = null;
  for (
    let sectionIndex = 0;
    sectionIndex < route.sections.length;
    sectionIndex++
  ) {
    const section = route.sections[sectionIndex];
    for (let stepIndex = 0; stepIndex < section.steps.length; stepIndex++) {
      const step = section.steps[stepIndex];
      if (
        step.type === "fragment_step" &&
        step.edgeIndex === edgeIndex &&
        isStandaloneTravel(step, areaId)
      ) {
        completionKey = [sectionIndex, stepIndex].toString();
      }
    }
  }

  return { edgeIndex, completionKey };
}
