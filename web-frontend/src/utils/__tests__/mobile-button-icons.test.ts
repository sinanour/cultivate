import { describe, it, expect } from 'vitest';
import { getMobileButtonIcon, MOBILE_BUTTON_ICONS } from '../mobile-button-icons';

describe('mobile-button-icons', () => {
  describe('MOBILE_BUTTON_ICONS', () => {
    it('should have mappings for create/add actions', () => {
      expect(MOBILE_BUTTON_ICONS['create']).toBe('add-plus');
      expect(MOBILE_BUTTON_ICONS['add']).toBe('add-plus');
      expect(MOBILE_BUTTON_ICONS['new']).toBe('add-plus');
      expect(MOBILE_BUTTON_ICONS['create participant']).toBe('add-plus');
      expect(MOBILE_BUTTON_ICONS['create activity']).toBe('add-plus');
      expect(MOBILE_BUTTON_ICONS['create venue']).toBe('add-plus');
      expect(MOBILE_BUTTON_ICONS['create geographic area']).toBe('add-plus');
    });

    it('should have mappings for filter actions', () => {
      expect(MOBILE_BUTTON_ICONS['update']).toBe('filter');
      expect(MOBILE_BUTTON_ICONS['apply']).toBe('filter');
      expect(MOBILE_BUTTON_ICONS['clear all']).toBe('undo');
      expect(MOBILE_BUTTON_ICONS['reset']).toBe('undo');
    });

    it('should have mappings for CSV actions', () => {
      expect(MOBILE_BUTTON_ICONS['import csv']).toBe('upload');
      expect(MOBILE_BUTTON_ICONS['export csv']).toBe('download');
    });

    it('should have mappings for activity actions', () => {
      expect(MOBILE_BUTTON_ICONS['mark complete']).toBe('status-positive');
      expect(MOBILE_BUTTON_ICONS['cancel activity']).toBe('status-negative');
    });

    it('should have mappings for navigation actions', () => {
      expect(MOBILE_BUTTON_ICONS['back']).toBe('arrow-left');
      expect(MOBILE_BUTTON_ICONS['back to participants']).toBe('arrow-left');
      expect(MOBILE_BUTTON_ICONS['back to activities']).toBe('arrow-left');
      expect(MOBILE_BUTTON_ICONS['back to venues']).toBe('arrow-left');
      expect(MOBILE_BUTTON_ICONS['back to geographic areas']).toBe('arrow-left');
    });

    it('should have mappings for report actions', () => {
      expect(MOBILE_BUTTON_ICONS['run report']).toBe('redo');
    });
  });

  describe('getMobileButtonIcon', () => {
    it('should return correct icon for exact match', () => {
      expect(getMobileButtonIcon('Create')).toBe('add-plus');
      expect(getMobileButtonIcon('Update')).toBe('filter');
      expect(getMobileButtonIcon('Clear All')).toBe('undo');
    });

    it('should be case-insensitive', () => {
      expect(getMobileButtonIcon('CREATE')).toBe('add-plus');
      expect(getMobileButtonIcon('UPDATE')).toBe('filter');
      expect(getMobileButtonIcon('CLEAR ALL')).toBe('undo');
      expect(getMobileButtonIcon('Create Participant')).toBe('add-plus');
      expect(getMobileButtonIcon('BACK TO ACTIVITIES')).toBe('arrow-left');
    });

    it('should trim whitespace', () => {
      expect(getMobileButtonIcon('  Create  ')).toBe('add-plus');
      expect(getMobileButtonIcon('  Update  ')).toBe('filter');
      expect(getMobileButtonIcon('  Clear All  ')).toBe('undo');
    });

    it('should return undefined for unmapped text', () => {
      expect(getMobileButtonIcon('Unknown Button')).toBeUndefined();
      expect(getMobileButtonIcon('Random Text')).toBeUndefined();
      expect(getMobileButtonIcon('')).toBeUndefined();
    });

    it('should handle all specific entity creation buttons', () => {
      expect(getMobileButtonIcon('Create Participant')).toBe('add-plus');
      expect(getMobileButtonIcon('Create Activity')).toBe('add-plus');
      expect(getMobileButtonIcon('Create Venue')).toBe('add-plus');
      expect(getMobileButtonIcon('Create Geographic Area')).toBe('add-plus');
    });

    it('should handle all back navigation buttons', () => {
      expect(getMobileButtonIcon('Back to Participants')).toBe('arrow-left');
      expect(getMobileButtonIcon('Back to Activities')).toBe('arrow-left');
      expect(getMobileButtonIcon('Back to Venues')).toBe('arrow-left');
      expect(getMobileButtonIcon('Back to Geographic Areas')).toBe('arrow-left');
    });

    it('should handle CSV import/export buttons', () => {
      expect(getMobileButtonIcon('Import CSV')).toBe('upload');
      expect(getMobileButtonIcon('Export CSV')).toBe('download');
    });

    it('should handle activity action buttons', () => {
      expect(getMobileButtonIcon('Mark Complete')).toBe('status-positive');
      expect(getMobileButtonIcon('Cancel Activity')).toBe('status-negative');
    });

    it('should handle report button', () => {
      expect(getMobileButtonIcon('Run Report')).toBe('redo');
    });
  });
});
