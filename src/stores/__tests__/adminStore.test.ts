import { useAdminStore } from '../adminStore';

describe('AdminStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAdminStore.setState({ isAdminMode: false });
  });

  describe('initial state', () => {
    it('starts with isAdminMode set to false', () => {
      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });
  });

  describe('activateAdmin', () => {
    it('sets isAdminMode to true', () => {
      useAdminStore.getState().activateAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(true);
    });

    it('remains true if already active', () => {
      useAdminStore.setState({ isAdminMode: true });
      useAdminStore.getState().activateAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(true);
    });
  });

  describe('deactivateAdmin', () => {
    it('sets isAdminMode to false', () => {
      useAdminStore.setState({ isAdminMode: true });
      useAdminStore.getState().deactivateAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('remains false if already inactive', () => {
      useAdminStore.getState().deactivateAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });
  });

  describe('toggleAdmin', () => {
    it('activates admin mode when inactive', () => {
      useAdminStore.getState().toggleAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(true);
    });

    it('deactivates admin mode when active (Requirement 1.5)', () => {
      useAdminStore.setState({ isAdminMode: true });
      useAdminStore.getState().toggleAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('toggles back and forth correctly', () => {
      useAdminStore.getState().toggleAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(true);
      useAdminStore.getState().toggleAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(false);
      useAdminStore.getState().toggleAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(true);
    });
  });

  describe('resetAdmin', () => {
    it('resets isAdminMode to false (Requirement 1.4)', () => {
      useAdminStore.setState({ isAdminMode: true });
      useAdminStore.getState().resetAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });

    it('is idempotent when already inactive', () => {
      useAdminStore.getState().resetAdmin();
      expect(useAdminStore.getState().isAdminMode).toBe(false);
    });
  });
});
