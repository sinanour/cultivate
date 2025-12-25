import type { GeographicArea } from '../types';

export interface TreeNode {
    id: string;
    text: string;
    children?: TreeNode[];
    data: GeographicArea;
}

export function buildGeographicAreaTree(areas: GeographicArea[]): TreeNode[] {
    const areaMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // Create nodes
    areas.forEach((area) => {
        areaMap.set(area.id, {
            id: area.id,
            text: area.name,
            children: [],
            data: area,
        });
    });

    // Build tree structure
    areas.forEach((area) => {
        const node = areaMap.get(area.id)!;
        if (area.parentGeographicAreaId) {
            const parent = areaMap.get(area.parentGeographicAreaId);
            if (parent) {
                parent.children!.push(node);
            } else {
                // Parent not found, treat as root
                rootNodes.push(node);
            }
        } else {
            rootNodes.push(node);
        }
    });

    return rootNodes;
}

export function findDescendants(areaId: string, areas: GeographicArea[]): string[] {
    const descendants: string[] = [];
    const children = areas.filter((a) => a.parentGeographicAreaId === areaId);

    children.forEach((child) => {
        descendants.push(child.id);
        descendants.push(...findDescendants(child.id, areas));
    });

    return descendants;
}

export function isCircularRelationship(
    areaId: string,
    newParentId: string,
    areas: GeographicArea[]
): boolean {
    if (areaId === newParentId) {
        return true; // Self-reference
    }

    const descendants = findDescendants(areaId, areas);
    return descendants.includes(newParentId);
}
