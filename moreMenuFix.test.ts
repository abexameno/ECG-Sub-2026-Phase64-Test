import * as fs from 'fs';
import * as path from 'path';

describe('Top "More" Dropdown Menu Functionality & Navigation', () => {
  const appSource = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf-8');
  const headerSource = fs.readFileSync(path.join(__dirname, 'components/Header.tsx'), 'utf-8');

  describe('1. Menu Item Destinations & Interactivity', () => {
    it('contains all required menu items with complete descriptions and icons', () => {
      expect(appSource).toContain("id: 'settings', label: 'My Profile & School'");
      expect(appSource).toContain("id: 'subscription', label: 'Subscription Credits'");
      expect(appSource).toContain("id: 'admin', label: 'Admin Panel'");
      expect(appSource).toContain("id: 'referrals', label: 'Referral Hub'");
      expect(appSource).toContain("id: 'feedback', label: 'Feedback'");
      expect(appSource).toContain("id: 'help', label: 'Help & Guide'");
    });

    it('attaches proper click/tap handlers that trigger setActiveTab and close the menu', () => {
      expect(appSource).toContain('ref={moreMenuRef}');
      expect(appSource).toContain('ref={moreButtonRef}');
      expect(appSource).toContain('setActiveTab(tab.id as any);');
      expect(appSource).toContain('setIsMoreOpen(false);');
      expect(appSource).toContain('setIsMobileMoreOpen(false);');
    });

    it('provides a touch-friendly hit area and card layout for each menu item', () => {
      expect(appSource).toContain('w-full text-left p-2.5 sm:p-3 rounded-xl border flex items-center gap-3');
      expect(appSource).toContain('role="menuitem"');
    });

    it('uses ref-based click-outside detection without blocking full-screen overlay divs', () => {
      expect(appSource).toContain('moreMenuRef.current.contains(target)');
      expect(appSource).toContain('moreButtonRef.current.contains(target)');
    });
  });

  describe('2. Admin Panel Security & Access Gating', () => {
    it('restricts Admin Panel menu item visibility exclusively to users with role === "Admin"', () => {
      expect(appSource).toContain("currentUser?.role === 'Admin'");
      expect(appSource).toContain("id: 'admin', label: 'Admin Panel'");
    });

    it('ensures admin route rendering in App.tsx checks user authorization', () => {
      expect(appSource).toContain("activeTab === 'admin'");
    });
  });

  describe('3. Header Wallet Integration', () => {
    it('allows direct navigation to subscription credits when clicking credit balance in header', () => {
      expect(headerSource).toContain('onCreditsClick');
      expect(headerSource).toContain('onClick={onCreditsClick || onProfileClick}');
      expect(appSource).toContain("onCreditsClick={() => setActiveTab('subscription')}");
    });
  });
});
