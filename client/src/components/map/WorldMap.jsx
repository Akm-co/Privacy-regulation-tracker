import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

const numericToAlpha2 = {
  '840': 'US', '826': 'GB', '276': 'DE', '250': 'FR', '380': 'IT', '724': 'ES',
  '528': 'NL', '056': 'BE', '040': 'AT', '616': 'PL', '203': 'CZ', '348': 'HU',
  '642': 'RO', '100': 'BG', '300': 'GR', '620': 'PT', '752': 'SE', '208': 'DK',
  '246': 'FI', '372': 'IE', '756': 'CH', '578': 'NO', '352': 'IS', '076': 'BR',
  '032': 'AR', '484': 'MX', '124': 'CA', '156': 'CN', '392': 'JP', '410': 'KR',
  '356': 'IN', '702': 'SG', '036': 'AU', '554': 'NZ', '764': 'TH', '360': 'ID',
  '458': 'MY', '608': 'PH', '704': 'VN', '784': 'AE', '682': 'SA', '048': 'BH',
  '376': 'IL', '710': 'ZA', '404': 'KE', '566': 'NG', '818': 'EG', '643': 'RU',
  '804': 'UA', '792': 'TR'
};

const countryNames = {
  'US': 'United States', 'GB': 'United Kingdom', 'DE': 'Germany', 'FR': 'France',
  'IT': 'Italy', 'ES': 'Spain', 'NL': 'Netherlands', 'BE': 'Belgium', 'AT': 'Austria',
  'PL': 'Poland', 'CZ': 'Czech Republic', 'HU': 'Hungary', 'RO': 'Romania',
  'BG': 'Bulgaria', 'GR': 'Greece', 'PT': 'Portugal', 'SE': 'Sweden', 'DK': 'Denmark',
  'FI': 'Finland', 'IE': 'Ireland', 'CH': 'Switzerland', 'NO': 'Norway', 'IS': 'Iceland',
  'BR': 'Brazil', 'AR': 'Argentina', 'MX': 'Mexico', 'CA': 'Canada', 'CN': 'China',
  'JP': 'Japan', 'KR': 'South Korea', 'IN': 'India', 'SG': 'Singapore', 'AU': 'Australia',
  'NZ': 'New Zealand', 'TH': 'Thailand', 'ID': 'Indonesia', 'MY': 'Malaysia',
  'PH': 'Philippines', 'VN': 'Vietnam', 'AE': 'UAE', 'SA': 'Saudi Arabia',
  'BH': 'Bahrain', 'IL': 'Israel', 'ZA': 'South Africa', 'KE': 'Kenya', 'NG': 'Nigeria',
  'EG': 'Egypt', 'RU': 'Russia', 'UA': 'Ukraine', 'TR': 'Turkey'
};

const getStrictnessColor = (score, isDark) => {
  if (!score || score === 0) return isDark ? '#374151' : '#d1d5db';
  if (score >= 8) return '#ef4444';
  if (score >= 6) return '#f97316';
  if (score >= 4) return '#eab308';
  return '#22c55e';
};

function WorldMap({ data, onRegionSelect, selectedRegion }) {
  const { isDark } = useTheme();
  const containerRef = useRef(null);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 });

  // Load TopoJSON
  useEffect(() => {
    fetch('/world-110m.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load map');
        return res.json();
      })
      .then(topo => {
        const geo = topojson.feature(topo, topo.objects.countries);
        const filtered = geo.features.filter(f =>
          f.id !== '010' && !(f.properties?.name || '').toLowerCase().includes('antarctica')
        );
        setCountries(filtered);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width || 900, height: rect.height || 500 });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const regionData = useMemo(() => {
    if (!data?.features) return {};
    const lookup = {};
    data.features.forEach(f => {
      lookup[f.properties.code] = f.properties;
      if (f.properties.code === 'UK') lookup['GB'] = f.properties;
    });
    return lookup;
  }, [data]);

  const projection = useMemo(() =>
    d3.geoNaturalEarth1()
      .scale(dimensions.width / 5.5)
      .translate([dimensions.width / 2, dimensions.height / 2]),
    [dimensions]
  );

  const pathGenerator = useMemo(() => d3.geoPath().projection(projection), [projection]);

  const getCode = (f) => numericToAlpha2[f.id] || null;
  const getName = (f) => countryNames[getCode(f)] || f.properties?.name || 'Unknown';

  const getFill = useCallback((f) => {
    const code = getCode(f);
    if (selectedRegion?.code === code) return '#6264a7';
    if (hovered?.id === f.id) return isDark ? '#818cf8' : '#6264a7';
    return getStrictnessColor(regionData[code]?.strictnessScore, isDark);
  }, [selectedRegion, hovered, isDark, regionData]);

  if (loading) {
    return (
      <div ref={containerRef} className="relative w-full h-full min-h-[400px] flex items-center justify-center rounded-xl"
           style={{ background: isDark ? '#0f172a' : '#e0f2fe' }}>
        <div className="animate-spin w-8 h-8 border-3 border-[#6264a7] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className="relative w-full h-full min-h-[400px] flex items-center justify-center rounded-xl text-red-500"
           style={{ background: isDark ? '#0f172a' : '#e0f2fe' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden">
      <div className="absolute inset-0" style={{
        background: isDark
          ? 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)'
          : 'linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%)'
      }} />

      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        <g>
          {countries.map((country, i) => {
            const path = pathGenerator(country);
            if (!path) return null;

            return (
              <path
                key={country.id || i}
                d={path}
                fill={getFill(country)}
                stroke={isDark ? '#475569' : '#94a3b8'}
                strokeWidth={hovered?.id === country.id ? 1.5 : 0.5}
                style={{ cursor: 'pointer', transition: 'fill 0.2s' }}
                onMouseEnter={(e) => {
                  setHovered(country);
                  setTooltip({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  const code = getCode(country);
                  const info = regionData[code];
                  onRegionSelect?.({
                    code,
                    name: getName(country),
                    regulationCount: info?.regulationCount || 0,
                    recentUpdateCount: info?.recentUpdates || 0
                  });
                }}
              />
            );
          })}
        </g>
      </svg>

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg shadow-xl text-sm"
            style={{
              left: tooltip.x + 15,
              top: tooltip.y - 10,
              background: isDark ? '#1e293b' : '#fff',
              border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`
            }}
          >
            <p className="font-semibold">{getName(hovered)}</p>
            <p className="text-xs opacity-60">
              {regionData[getCode(hovered)]?.regulationCount || 0} regulations
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-3 left-3 rounded-lg p-3 text-xs" style={{
        background: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
      }}>
        <p className="font-semibold mb-2">Strictness</p>
        {[
          { color: '#ef4444', label: 'Very Strict' },
          { color: '#f97316', label: 'Strict' },
          { color: '#eab308', label: 'Moderate' },
          { color: '#22c55e', label: 'Minimal' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
            <span className="opacity-70">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(WorldMap);
