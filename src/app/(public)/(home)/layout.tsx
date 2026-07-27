import { PublicSiteShell } from "@/features/public-site/components/shell/PublicSiteShell";
import { HOMEPAGE_SHELL_CONFIG } from "@/features/public-site/config/public-navigation";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const { headerMode, navigation, cta, footer } = HOMEPAGE_SHELL_CONFIG;

  return (
    <PublicSiteShell
      headerMode={headerMode}
      navigation={navigation}
      cta={cta}
      footer={footer}
    >
      {children}
    </PublicSiteShell>
  );
}
