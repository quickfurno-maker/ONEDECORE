import { PM_ASSETS } from "@/features/public-site/home-r4/content";
import type { DiscoveryAssetKey } from "./discovery-copy";

export const DISCOVERY_ASSETS = {
  hero: PM_ASSETS.hero,
  completeHomeInteriors: PM_ASSETS.completeHomeInteriors,
  modularKitchens: PM_ASSETS.modularKitchens,
  customWardrobes: PM_ASSETS.customWardrobes,
  dusk: PM_ASSETS.dusk,
  oakJoinery: PM_ASSETS.materialTimber,
  flutedTexture: PM_ASSETS.materialTexture,
  travertineBronze: PM_ASSETS.materialStone,
} as const satisfies Record<DiscoveryAssetKey, (typeof PM_ASSETS)[keyof typeof PM_ASSETS]>;

export function getDiscoveryAsset(key: DiscoveryAssetKey) {
  return DISCOVERY_ASSETS[key];
}
