import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TERRACE_CONFIG,
  DEFAULT_EXTERIOR_CONFIG,
  RAILING_STYLES,
  SHADING_STRUCTURES,
  TERRACE_FLOOR_OPTIONS,
  FACADE_PRESETS,
  TERRACE_FURNITURE_CATALOG,
  getTerraceFurnitureById,
  getFacadePreset,
  getRailingSpec,
  getShadingSpec,
} from '../terrace-catalog';
import { TERRACE_DESIGNS, TERRACE_DESIGNS_LIST, applyTerraceGrid } from '../architectural-layouts';
import type { Room } from '@houseplan/design-schema';

describe('terrace-catalog', () => {
  it('has valid default configurations', () => {
    expect(DEFAULT_TERRACE_CONFIG).toBeDefined();
    expect(DEFAULT_TERRACE_CONFIG.railingStyle).toBe('glass');
    expect(DEFAULT_TERRACE_CONFIG.parapetHeight).toBeGreaterThan(0.5);
    expect(DEFAULT_TERRACE_CONFIG.hasMumty).toBe(true);

    expect(DEFAULT_EXTERIOR_CONFIG).toBeDefined();
    expect(DEFAULT_EXTERIOR_CONFIG.facadeStyle).toBe('modern');
    expect(DEFAULT_EXTERIOR_CONFIG.hasBoundaryWall).toBe(true);
    expect(DEFAULT_EXTERIOR_CONFIG.hasMainGate).toBe(true);
  });

  it('contains 5 diverse railing styles', () => {
    expect(RAILING_STYLES.length).toBe(5);
    const ids = RAILING_STYLES.map(r => r.id);
    expect(ids).toContain('glass');
    expect(ids).toContain('metal_slats');
    expect(ids).toContain('jali');
    expect(ids).toContain('baluster');
    expect(ids).toContain('solid_parapet');
    expect(getRailingSpec('glass')).toBeDefined();
  });

  it('contains 6 shading structures including none', () => {
    expect(SHADING_STRUCTURES.length).toBe(6);
    const ids = SHADING_STRUCTURES.map(s => s.id);
    expect(ids).toContain('none');
    expect(ids).toContain('pergola');
    expect(ids).toContain('covered_pavilion');
    expect(ids).toContain('sky_lounge');
    expect(ids).toContain('solar_rack');
    expect(ids).toContain('indian_chhatri');
    expect(getShadingSpec('indian_chhatri')).toBeDefined();
  });

  it('contains 5 architectural facade presets', () => {
    expect(FACADE_PRESETS.length).toBe(5);
    const ids = FACADE_PRESETS.map(f => f.id);
    expect(ids).toContain('modern');
    expect(ids).toContain('contemporary');
    expect(ids).toContain('traditional_indian');
    expect(ids).toContain('luxury');
    expect(ids).toContain('minimalist');

    const found = getFacadePreset('traditional_indian');
    expect(found?.name).toBe('Traditional Indian Heritage');
  });

  it('contains outdoor and terrace furniture catalog', () => {
    expect(TERRACE_FURNITURE_CATALOG.length).toBeGreaterThan(6);
    const bbq = getTerraceFurnitureById('bbq_grill');
    expect(bbq).toBeDefined();
    expect(bbq?.name).toContain('Barbecue');

    const solar = getTerraceFurnitureById('solar_array');
    expect(solar).toBeDefined();
    expect(solar?.category).toBe('utility');
  });

  it('provides all 9 selectable terrace layouts in architectural-layouts', () => {
    expect(TERRACE_DESIGNS_LIST.length).toBe(9);
    const ids = TERRACE_DESIGNS_LIST.map(d => d.id);
    expect(ids).toContain('open');
    expect(ids).toContain('garden');
    expect(ids).toContain('pergola');
    expect(ids).toContain('covered');
    expect(ids).toContain('lounge');
    expect(ids).toContain('outdoor_dining');
    expect(ids).toContain('utility');
    expect(ids).toContain('solar');
    expect(ids).toContain('traditional_indian');
  });

  it('applies genuine room topology for each terrace design', () => {
    for (const design of TERRACE_DESIGNS_LIST) {
      const rooms: Room[] = [];
      applyTerraceGrid('test', design.id, 0, 0, 20, 20, rooms);
      expect(rooms.length).toBeGreaterThan(0);
      for (const room of rooms) {
        expect(room.name).toBeTruthy();
        expect(room.polygon.length).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
