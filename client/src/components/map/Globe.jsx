import { useRef, useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useTheme } from '../../context/ThemeContext';

// Dynamically import Globe to handle potential errors
const GlobeGL = lazy(() => import('react-globe.gl').then(mod => ({ default: mod.default })));

// Color scale based on strictness score
const getStrictnessColor = (score, isDark) => {
  if (!score) return isDark ? '#374151' : '#e5e7eb';
  if (score >= 8) return '#dc2626'; // Red - strict
  if (score >= 6) return '#ea580c'; // Orange
  if (score >= 4) return '#ca8a04'; // Yellow
  return '#16a34a'; // Green - less strict
};

// Fallback component while Globe loads
function GlobeFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500/10 to-accent-500/10 rounded-xl">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-pulse">🌍</div>
        <p className="text-surface-500">Loading Globe...</p>
      </div>
    </div>
  );
}

// Error boundary for Globe
function GlobeErrorFallback({ error }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500/10 to-accent-500/10 rounded-xl">
      <div className="text-center p-4">
        <div className="text-6xl mb-4">🌍</div>
        <p className="text-surface-500 font-medium">Interactive Globe</p>
        <p className="text-sm text-surface-400 mt-2">3D visualization unavailable</p>
        <p className="text-xs text-red-400 mt-2">{error?.message}</p>
      </div>
    </div>
  );
}

function GlobeInner({ data, onRegionSelect, selectedRegion }) {
  const globeRef = useRef();
  const containerRef = useRef();
  const { isDark } = useTheme();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [globeError, setGlobeError] = useState(null);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Auto-rotate globe - wait for globe to be ready
  useEffect(() => {
    const setupControls = () => {
      if (globeRef.current && globeRef.current.controls) {
        try {
          const controls = globeRef.current.controls();
          if (controls) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.5;
            controls.enableZoom = true;

            // Stop rotation on interaction
            controls.addEventListener('start', () => {
              controls.autoRotate = false;
            });
          }
        } catch (e) {
          console.warn('Globe controls error:', e);
        }
      }
    };

    // Delay setup to ensure globe is ready
    const timer = setTimeout(setupControls, 500);
    return () => clearTimeout(timer);
  }, [dimensions]);

  // Process data for globe
  const pointsData = useMemo(() => {
    if (!data?.features) return [];

    return data.features
      .filter(f => f.geometry?.coordinates) // Ensure valid coordinates
      .map((feature) => ({
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        ...feature.properties,
        color: getStrictnessColor(feature.properties.strictnessScore, isDark),
        // Make ALL points visible and clickable
        size: feature.properties.regulationCount > 0
          ? 1.0 + (feature.properties.strictnessScore / 10)
          : 0.6,
        altitude: feature.properties.regulationCount > 0 ? 0.08 : 0.03
      }));
  }, [data, isDark]);

  // Debug: log points data
  useEffect(() => {
    if (pointsData.length > 0) {
      console.log('Globe points data:', pointsData.length, 'points');
      console.log('Sample point:', pointsData[0]);
    }
  }, [pointsData]);

  // Ring data for active regions
  const ringsData = useMemo(() => {
    if (!data?.features) return [];

    return data.features
      .filter((f) => f.properties.hasRecentActivity)
      .map((feature) => ({
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        maxR: 3,
        propagationSpeed: 2,
        repeatPeriod: 1000,
        color: '#00B4D8'
      }));
  }, [data]);

  // Handle point click
  const handlePointClick = useCallback(
    (point, event, coords) => {
      console.log('Point clicked:', point);
      if (point && onRegionSelect) {
        onRegionSelect({
          code: point.code,
          name: point.name,
          regulationCount: point.regulationCount || 0,
          recentUpdateCount: point.recentUpdates || 0
        });

        // Zoom to point
        if (globeRef.current) {
          try {
            globeRef.current.pointOfView(
              { lat: point.lat, lng: point.lng, altitude: 1.5 },
              1000
            );
          } catch (e) {
            console.warn('Globe zoom error:', e);
          }
        }
      }
    },
    [onRegionSelect]
  );

  // Handle globe click (fallback for clicking anywhere)
  const handleGlobeClick = useCallback(
    (coords, event) => {
      console.log('Globe clicked at:', coords);
    },
    []
  );

  // Label rendering
  const labelRenderer = useCallback(
    (point) => {
      const el = document.createElement('div');
      el.innerHTML = `
        <div class="map-tooltip">
          <strong>${point.name}</strong><br/>
          <small>${point.regulationCount || 0} regulations</small>
          ${point.recentUpdates > 0 ? `<br/><small style="color: #00B4D8">${point.recentUpdates} new updates</small>` : ''}
        </div>
      `;
      return el;
    },
    []
  );

  if (globeError) {
    return <GlobeErrorFallback error={globeError} />;
  }

  return (
    <div ref={containerRef} className="globe-container w-full h-full">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Suspense fallback={<GlobeFallback />}>
          <GlobeGL
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            globeImageUrl={
              isDark
                ? '//unpkg.com/three-globe/example/img/earth-night.jpg'
                : '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
            }
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl={
              isDark
                ? '//unpkg.com/three-globe/example/img/night-sky.png'
                : null
            }
            backgroundColor={isDark ? '#1a1a2e' : '#f8f9fa'}

            // Points (regions)
            pointsData={pointsData}
            pointLat="lat"
            pointLng="lng"
            pointColor="color"
            pointAltitude="altitude"
            pointRadius="size"
            pointResolution={12}
            pointLabel={labelRenderer}
            onPointClick={handlePointClick}
            onGlobeClick={handleGlobeClick}
            pointsMerge={false}

            // Rings (activity indicators)
            ringsData={ringsData}
            ringLat="lat"
            ringLng="lng"
            ringColor="color"
            ringMaxRadius="maxR"
            ringPropagationSpeed="propagationSpeed"
            ringRepeatPeriod="repeatPeriod"

            // Atmosphere
            atmosphereColor={isDark ? '#00B4D8' : '#1E3A5F'}
            atmosphereAltitude={0.25}

            // Controls
            enablePointerInteraction={true}
          />
        </Suspense>
      )}

      {/* Legend - pointer-events-auto to allow interaction with legend but not block globe */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-surface-800/90 backdrop-blur-sm rounded-lg p-3 text-xs pointer-events-auto z-10">
        <p className="font-semibold mb-2">Regulation Strictness</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span>Very Strict (8-10)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Strict (6-8)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Moderate (4-6)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span>Minimal (1-4)</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-surface-200 dark:border-surface-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-accent-500 animate-pulse" />
            <span>Recent Activity</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Globe component with error boundary
export default function Globe(props) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset error state if props change
    setHasError(false);
    setError(null);
  }, [props.data]);

  if (hasError) {
    return <GlobeErrorFallback error={error} />;
  }

  return (
    <Suspense fallback={<GlobeFallback />}>
      <GlobeInner {...props} />
    </Suspense>
  );
}
