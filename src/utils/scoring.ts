import { RollData, Defect, FabricGroup, FabricType } from '../types';

export interface RollStats {
    points1: number;
    points2: number;
    points3: number;
    points4: number;
    totalPoints: number;
    score: number;
    isPass: boolean;
    lengthYards: number;
    widthInches: number;
}

/**
 * Dynamic group mapping for Woven and Knitted based on Intertek Protocols.
 */
export const getFabricGroupMapping = (type: FabricType) => {
    if (type === FabricType.KNITTED) {
        return {
            [FabricGroup.GROUP_A]: 'Synthetics, Polyester, Nylon, Acetate',
            [FabricGroup.GROUP_B]: 'Woolen spun, Spun Rayon, Basic Knitted',
            [FabricGroup.GROUP_C]: 'Stretch fabric / Lycra blends',
            [FabricGroup.GROUP_D]: 'Linen, Linen/Cotton, Rayon Blends'
        };
    }
    if (type === FabricType.OTHER) {
        return {
            [FabricGroup.GROUP_A]: 'Standard Group A',
            [FabricGroup.GROUP_B]: 'Standard Group B',
            [FabricGroup.GROUP_C]: 'Standard Group C',
            [FabricGroup.GROUP_D]: 'Standard Group D'
        };
    }
    return {
        [FabricGroup.GROUP_A]: 'Synthetics, Worsted Woolens, Silk Taffeta',
        [FabricGroup.GROUP_B]: 'Poplin, Oxford, Light weight Denim',
        [FabricGroup.GROUP_C]: 'Stretch denim, Velvet, Corduroy',
        [FabricGroup.GROUP_D]: 'Linen, Linen/Cotton, Rayon Blends'
    };
};

/**
 * Bow/Skew Tolerance per Intertek.
 */
export const getBowSkewTolerance = (type: FabricType, isPrint: boolean): string => {
    if (type === FabricType.KNITTED) {
        return isPrint ? '2%' : '5%'; // Knitted solid 5%
    }
    if (type === FabricType.OTHER) {
        return isPrint ? '2%' : '3%'; // Default to woven
    }
    return isPrint ? '2%' : '3%'; // Woven solid 3%
};

/**
 * Intertek standard thresholds for individual rolls based on fabric group.
 */
export const getThresholdByGroup = (group: FabricGroup | undefined): number => {
    switch (group) {
        case FabricGroup.GROUP_A: return 20;
        case FabricGroup.GROUP_B: return 25;
        case FabricGroup.GROUP_C: return 35;
        case FabricGroup.GROUP_D: return 40;
        default: return 20;
    }
};

/**
 * Get effective points for a defect.
 */
export const getEffectivePoints = (defect: Defect): number => {
    if (defect.isHole || defect.isContinuous) return 4;
    return defect.points;
};

export const suggestPointsFromLength = (lengthInches: number): 1 | 2 | 3 | 4 => {
    if (lengthInches <= 3) return 1;
    if (lengthInches <= 6) return 2;
    if (lengthInches <= 9) return 3;
    return 4;
};

/**
 * Calculate roll statistics using Intertek Formula.
 */
export const calculateRollStats = (roll: RollData, passThreshold: number = 20): RollStats => {
    const effectivePointsList = roll.defects.map(d => getEffectivePoints(d));

    const points1 = effectivePointsList.filter(p => p === 1).length;
    const points2 = effectivePointsList.filter(p => p === 2).length;
    const points3 = effectivePointsList.filter(p => p === 3).length;
    const points4 = effectivePointsList.filter(p => p === 4).length;
    const totalPoints = effectivePointsList.reduce((acc, p) => acc + p, 0);

    const lengthYards = (roll.actualLength || roll.length) * 1.09361;
    const widthInches = (roll.cuttableWidth || roll.width);

    const score = lengthYards > 0 && widthInches > 0
        ? (totalPoints * 3600) / (lengthYards * widthInches)
        : 0;

    const isPass = score <= passThreshold;

    return { points1, points2, points3, points4, totalPoints, score, isPass, lengthYards, widthInches };
};
