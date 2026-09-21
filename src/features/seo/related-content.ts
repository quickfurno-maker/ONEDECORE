export interface RelatedSeoLink { readonly href: string; readonly label: string; readonly description: string; }
export const RELATED_SEO_LINKS: readonly RelatedSeoLink[] = [
 {href:"/services/complete-home-interiors",label:"Complete home interiors",description:"Plan multiple rooms, materials and installation as one coordinated scope."},
 {href:"/services/modular-kitchens",label:"Modular kitchens",description:"Plan kitchen workflow, storage, materials and finishes."},
 {href:"/services/wardrobes",label:"Custom wardrobes",description:"Plan internal storage and made-to-fit wardrobes around the room."},
 {href:"/services/home-renovation",label:"Home renovation",description:"Coordinate retained work, civil changes, services and new interiors."},
 {href:"/interior-cost",label:"Interior cost guides",description:"Understand the factors that shape a Pune interior quotation."},
 {href:"/designs",label:"Design library",description:"Explore room-planning guidance for kitchens, bedrooms, wardrobes and living rooms."},
 {href:"/guides",label:"Interior planning guides",description:"Research materials, layouts, quotations, renovation and project planning."},
 {href:"/pune",label:"Pune service areas",description:"Browse area-specific planning information across Pune."},
 {href:"/portfolio",label:"Pune interior projects",description:"Explore ONEDECORE's published portfolio and project details."}
] as const;
