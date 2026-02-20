"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { feature } from "topojson-client";
import type { FeatureCollection, Position, Feature, Geometry } from "geojson";
import { countrySubreddits, countryMap } from "@/app/data/subreddits";
import type { CountrySubreddit, CitySubreddit, PlaceSubreddit } from "@/app/data/subreddits";
import InfoPanel from "./InfoPanel";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json";
const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const DEFAULT_CENTER: L.LatLngExpression = [20, 10];
const DEFAULT_ZOOM = 3;

/**
 * Fixes antimeridian rendering artifacts for Leaflet.
 * When a polygon ring jumps > 180° in longitude between consecutive points
 * (e.g. Russia crossing 180°/-180°), Leaflet draws a line across the whole map.
 * This makes coordinates continuous by accumulating an offset at each crossing.
 */
function fixAntimeridian(fc: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features.map((f) => ({
      ...f,
      geometry: fixGeom(f.geometry),
    })) as Feature[],
  };
}

function fixGeom(geom: Geometry): Geometry {
  if (geom.type === "Polygon") {
    return { ...geom, coordinates: geom.coordinates.map(makeContinuous) };
  }
  if (geom.type === "MultiPolygon") {
    return {
      ...geom,
      coordinates: geom.coordinates.map((poly) => poly.map(makeContinuous)),
    };
  }
  return geom;
}

function makeContinuous(ring: Position[]): Position[] {
  if (ring.length < 2) return ring;
  const out: Position[] = [ring[0]];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    const diff = ring[i][0] - ring[i - 1][0];
    if (diff > 180) offset -= 360;
    else if (diff < -180) offset += 360;
    out.push([ring[i][0] + offset, ring[i][1]]);
  }
  return out;
}

export default function WorldMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const countryLayersRef = useRef(new Map<string, L.Path>());
  const selectedLayerRef = useRef<L.Path | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const cityGroupRef = useRef<L.LayerGroup | null>(null);
  const placeGroupRef = useRef<L.LayerGroup | null>(null);

  const [selected, setSelected] = useState<{
    country: CountrySubreddit | null;
    city: CitySubreddit | null;
    place: PlaceSubreddit | null;
  }>({ country: null, city: null, place: null });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const actionsRef = useRef({
    selectCountry: (_id: string, _layer: L.Path) => {},
    selectCity: (_country: CountrySubreddit, _city: CitySubreddit) => {},
    selectPlace: (_country: CountrySubreddit, _city: CitySubreddit, _place: PlaceSubreddit) => {},
  });

  actionsRef.current.selectCountry = (id: string, layer: L.Path) => {
    const country = countryMap.get(id);
    if (!country) return;

    if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
      selectedLayerRef.current.setStyle({ fillOpacity: 0.08, weight: 1 });
    }
    selectedLayerRef.current = layer;
    layer.setStyle({ fillOpacity: 0.2, weight: 2 });

    setSelected({ country, city: null, place: null });
  };

  actionsRef.current.selectCity = (
    country: CountrySubreddit,
    city: CitySubreddit
  ) => {
    setSelected({ country, city, place: null });
  };

  actionsRef.current.selectPlace = (
    country: CountrySubreddit,
    city: CitySubreddit,
    place: PlaceSubreddit
  ) => {
    setSelected({ country, city, place });
  };

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 2,
      maxZoom: 19,
      zoomControl: false,
      worldCopyJump: true,
      attributionControl: false,
    });

    L.tileLayer(TILE_URL, { maxZoom: 20 }).addTo(map);
    L.control
      .attribution({ position: "bottomleft", prefix: false })
      .addTo(map);

    mapRef.current = map;
    cityGroupRef.current = L.layerGroup().addTo(map);
    placeGroupRef.current = L.layerGroup().addTo(map);

    fetch(GEO_URL)
      .then((r) => r.json())
      .then((topo) => {
        const raw = feature(
          topo,
          topo.objects.countries
        ) as unknown as FeatureCollection;
        const geo = fixAntimeridian(raw);

        const geoLayer = L.geoJSON(geo, {
          style: (f) => {
            const c = f ? countryMap.get(String(f.id)) : null;
            return {
              fillColor: c ? "#FF4500" : "transparent",
              fillOpacity: c ? 0.08 : 0,
              color: c ? "rgba(255,69,0,0.3)" : "transparent",
              weight: c ? 1 : 0,
            };
          },
          onEachFeature: (f, layer) => {
            const country = countryMap.get(String(f.id));
            if (!country) return;

            const path = layer as L.Path;
            countryLayersRef.current.set(country.id, path);
            countryLayersRef.current.set(
              country.id.replace(/^0+/, "") || "0",
              path
            );

            path.bindTooltip(`r/${country.subreddit}`, {
              sticky: true,
              className: "subreddit-tooltip",
              direction: "top",
              offset: [0, -8],
            });

            path.on("mouseover", () => {
              if (selectedLayerRef.current !== path) {
                path.setStyle({ fillOpacity: 0.3, weight: 1.5 });
              }
              path.bringToFront();
            });

            path.on("mouseout", () => {
              if (selectedLayerRef.current !== path) {
                path.setStyle({ fillOpacity: 0.08, weight: 1 });
              }
            });

            path.on("click", () => {
              actionsRef.current.selectCountry(country.id, path);
            });
          },
        }).addTo(map);
        geoLayerRef.current = geoLayer;
      });

    map.on("zoomend", () => {
      const z = map.getZoom();
      zoomRef.current = z;
      setZoom(z);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Rebuild city/place markers and update overlay opacity when zoom changes
  useEffect(() => {
    const cityGroup = cityGroupRef.current;
    const placeGroup = placeGroupRef.current;
    if (!cityGroup || !placeGroup) return;

    cityGroup.clearLayers();
    placeGroup.clearLayers();

    if (zoom >= 4) {
      const labelMinSubs =
        zoom >= 10 ? 0 : zoom >= 8 ? 30000 : zoom >= 6 ? 100000 : Infinity;

      for (const country of countrySubreddits) {
        for (const city of country.cities) {
          const r = Math.max(4, Math.log10(city.subscribers) * 2);
          const isActive =
            selected.city?.name === city.name &&
            selected.country?.id === country.id;

          const marker = L.circleMarker(
            [city.coordinates[1], city.coordinates[0]],
            {
              radius: isActive ? r + 3 : r,
              fillColor: isActive ? "#FFD700" : "#FF6B35",
              fillOpacity: 0.85,
              color: isActive ? "#fff" : "#FF8C00",
              weight: isActive ? 2 : 1,
            }
          );

          if (city.subscribers >= labelMinSubs) {
            marker.bindTooltip(city.name, {
              permanent: true,
              direction: "top",
              offset: [0, -(r + 4)],
              className: "city-label",
            });
          } else {
            marker.bindTooltip(`r/${city.subreddit}`, {
              className: "subreddit-tooltip",
              direction: "top",
            });
          }

          marker.on("click", () => {
            actionsRef.current.selectCity(country, city);
          });

          marker.addTo(cityGroup);
        }
      }
    }

    if (zoom >= 10) {
      const placeLabelMin =
        zoom >= 14 ? 0 : zoom >= 12 ? 3000 : Infinity;

      for (const country of countrySubreddits) {
        for (const city of country.cities) {
          if (!city.places) continue;
          for (const place of city.places) {
            const r = Math.max(10, (Math.log10(place.subscribers) - 2) * 4);
            const isActive =
              selected.place?.name === place.name &&
              selected.city?.name === city.name;

            const marker = L.circleMarker(
              [place.coordinates[1], place.coordinates[0]],
              {
                radius: isActive ? r + 3 : r,
                fillColor: isActive ? "#e9d5ff" : "#c084fc",
                fillOpacity: 0.8,
                color: isActive ? "#fff" : "#a855f7",
                weight: isActive ? 2 : 1,
                pane: "markerPane",
              }
            );

            if (place.subscribers >= placeLabelMin) {
              marker.bindTooltip(place.name, {
                permanent: true,
                direction: "top",
                offset: [0, -(r + 3)],
                className: "place-label",
              });
            } else {
              marker.bindTooltip(`r/${place.subreddit}`, {
                className: "subreddit-tooltip",
                direction: "top",
              });
            }

            marker.on("mouseover", () => {
              marker.setRadius(r + 4);
              marker.setStyle({ fillOpacity: 1, weight: 2 });
            });

            marker.on("mouseout", () => {
              marker.setRadius(isActive ? r + 3 : r);
              marker.setStyle({
                fillOpacity: 0.8,
                weight: isActive ? 2 : 1,
              });
            });

            marker.on("click", () => {
              actionsRef.current.selectPlace(country, city, place);
            });

            marker.addTo(placeGroup);
          }
        }
      }
    }
  }, [zoom, selected]);

  const resetSelectedLayer = useCallback(() => {
    if (selectedLayerRef.current) {
      selectedLayerRef.current.setStyle({ fillOpacity: 0.08, weight: 1 });
      selectedLayerRef.current = null;
    }
  }, []);

  const handleBack = useCallback(() => {
    if (selected.place) {
      setSelected((s) => ({ ...s, place: null }));
    } else if (selected.city) {
      setSelected((s) => ({ ...s, city: null, place: null }));
    } else {
      resetSelectedLayer();
      setSelected({ country: null, city: null, place: null });
    }
  }, [selected.place, selected.city, resetSelectedLayer]);

  const handleClose = useCallback(() => {
    resetSelectedLayer();
    setSelected({ country: null, city: null, place: null });
  }, [resetSelectedLayer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleBack]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      <InfoPanel
        country={selected.country}
        city={selected.city}
        place={selected.place}
        onBack={handleBack}
        onClose={handleClose}
        onCityClick={(city) =>
          selected.country &&
          actionsRef.current.selectCity(selected.country, city)
        }
        onPlaceClick={(place) =>
          selected.country &&
          selected.city &&
          actionsRef.current.selectPlace(selected.country, selected.city, place)
        }
      />

      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-[1000]">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-10 h-10 rounded-lg text-white text-lg flex items-center justify-center transition-all hover:brightness-150"
          style={{
            background: "rgba(13,17,23,0.8)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-10 h-10 rounded-lg text-white text-lg flex items-center justify-center transition-all hover:brightness-150"
          style={{
            background: "rgba(13,17,23,0.8)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          −
        </button>
      </div>

      <div className="absolute top-5 left-6 z-[1000]">
        <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-lg">
          <span style={{ color: "#FF4500" }}>Reddit</span> Map
        </h1>
        <p
          className="text-xs mt-1 drop-shadow"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Click a highlighted country to explore
        </p>
      </div>

      {selected.country && (
        <button
          onClick={handleClose}
          className="absolute top-5 z-[1000] px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:brightness-150"
          style={{
            background: "rgba(13,17,23,0.8)",
            border: "1px solid rgba(255,255,255,0.1)",
            right: "calc(clamp(280px, 25vw, 360px) + 20px)",
          }}
        >
          Reset View
        </button>
      )}
    </div>
  );
}
