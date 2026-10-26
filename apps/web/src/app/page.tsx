"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle, ArrowRight, ArrowUpRight, Box, ChevronDown,
  CircleHelp, Copy, FolderOpen, Heart, Home, Layers, Layers3, LayoutGrid, MoreVertical,
  Pencil, Plus, RefreshCw, Search, Settings2,
  SquareDashed, SquarePen, Trash2,
} from "lucide-react";
import { ApiError, deleteProject, duplicateProject, listProjects, renameProject, type ProjectSummary } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { AccountMenu } from "@/components/auth/AccountMenu";

type LoadState = "loading" | "ready" | "error";
type SortOrder = "updated" | "name" | "created";

const EXAMPLE_PROJECTS = [
  { name: "Willow Residence", type: "Single-storey home", sqft: "1,200 sq ft", floors: "1 Floor", image: "/images/home-willow.jpg", edited: "2 hours ago" },
  { name: "Courtyard House",  type: "Contemporary",       sqft: "2,400 sq ft", floors: "2 Floors", image: "/images/home-courtyard.jpg", edited: "1 day ago" },
  { name: "Weekend Retreat",  type: "Compact cabin",      sqft: "850 sq ft",   floors: "1 Floor",  image: "/images/home-retreat.jpg",   edited: "3 days ago" },
  { name: "Lakeview Villa",   type: "3 BHK • Modern",    sqft: "3,200 sq ft", floors: "2 Floors", image: "/images/home-lakeview.jpg",  edited: "5 days ago" },
];

function ProjectBody({ type, sqft, floors, edited }: { type: string; sqft: string; floors: string; edited: string }) {
  return (
    <>
      <p className="project-type">{type}</p>
      <div className="project-bottom">
        <div>
          <div className="project-meta">
            <span className="project-meta-item"><SquareDashed size={15} strokeWidth={1.6} /> {sqft}</span>
            <span className="project-meta-item"><Layers size={15} strokeWidth={1.6} /> {floors}</span>
          </div>
          <span className="project-time">Edited {edited}</span>
        </div>
        <span className="project-open-btn">Open <ArrowRight size={14} strokeWidth={2} /></span>
      </div>
    </>
  );
}

/* ── Project Card (real API data) ── */
function ProjectCard({
  project, onRenamed, onDuplicated, onDeleted, onError,
}: {
  project: ProjectSummary;
  onRenamed: (p: ProjectSummary) => void;
  onDuplicated: (p: ProjectSummary) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const img = EXAMPLE_PROJECTS[(parseInt(project.id, 36) || 0) % 4].image;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const handleRename = async (name: string) => {
    setRenaming(false);
    if (!name.trim() || name.trim() === project.name) return;
    setBusy(true);
    try { onRenamed(await renameProject(project.id, name.trim())); }
    catch (err) { onError(err instanceof ApiError ? err.message : "Could not rename."); }
    finally { setBusy(false); }
  };
  const handleDuplicate = async (e: React.MouseEvent) => {
    e.preventDefault(); setMenuOpen(false); setBusy(true);
    try { onDuplicated(await duplicateProject(project.id)); }
    catch (err) { onError(err instanceof ApiError ? err.message : "Could not duplicate."); }
    finally { setBusy(false); }
  };
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); setMenuOpen(false);
    if (!window.confirm(`Delete "${project.name}"?`)) return;
    setBusy(true);
    try { await deleteProject(project.id); onDeleted(project.id); }
    catch (err) { onError(err instanceof ApiError ? err.message : "Could not delete."); setBusy(false); }
  };

  return (
    <Link href={`/studio/${project.id}`} className="project-card" aria-disabled={busy} onClick={(e) => busy && e.preventDefault()}>
      <div className="project-art">
        <Image src={img} alt="" fill sizes="(max-width:540px) 100vw, (max-width:1024px) 50vw, 25vw" quality={90} />
        <div className="project-menu" ref={menuRef}>
          <button className="project-more" aria-label={`More actions for ${project.name}`}
            onClick={(e) => { e.preventDefault(); setMenuOpen(o => !o); }}>
            <MoreVertical size={16} strokeWidth={2.4} />
          </button>
          {menuOpen && (
            <div className="project-menu-dropdown">
              <button onClick={(e) => { e.preventDefault(); setMenuOpen(false); setRenaming(true); }}><Pencil size={12} /> Rename</button>
              <button onClick={handleDuplicate}><Copy size={12} /> Duplicate</button>
              <button className="danger" onClick={handleDelete}><Trash2 size={12} /> Delete</button>
            </div>
          )}
        </div>
      </div>
      <div className="project-info">
        {renaming ? (
          <input className="project-rename-field" autoFocus defaultValue={project.name}
            onClick={e => e.preventDefault()}
            onBlur={e => handleRename(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenaming(false); }} />
        ) : (
          <h3>{project.name}</h3>
        )}
        <ProjectBody
          type={`${project.roomCount} rooms • ${project.units}`}
          sqft={`${project.plotWidth * project.plotLength} ${project.units}²`}
          floors="1 Floor"
          edited={formatRelativeTime(project.updatedAt)}
        />
      </div>
    </Link>
  );
}

/* ── Example Project Card (no API data) ── */
function ExampleCard({ ex }: { ex: typeof EXAMPLE_PROJECTS[0] }) {
  return (
    <Link href="/new-design" className="project-card">
      <div className="project-art">
        <Image src={ex.image} alt={ex.name} fill sizes="(max-width:540px) 100vw, (max-width:1024px) 50vw, 25vw" quality={90} />
        <div className="project-menu">
          <button className="project-more" onClick={e => e.preventDefault()} aria-label="More"><MoreVertical size={16} strokeWidth={2.4} /></button>
        </div>
      </div>
      <div className="project-info">
        <h3>{ex.name}</h3>
        <ProjectBody type={ex.type} sqft={ex.sqft} floors={ex.floors} edited={ex.edited} />
      </div>
    </Link>
  );
}

/* ════════════════════════════════════════════
   HOME PAGE
   ════════════════════════════════════════════ */
export default function HomePage() {
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("updated");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    listProjects()
      .then(data => { if (!cancelled) { setProjects(data); setState("ready"); } })
      .catch(err => { if (!cancelled) { setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong."); setState("error"); } });
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? projects.filter(p => p.name.toLowerCase().includes(q)) : projects;
    const sorted = [...filtered];
    if (sortOrder === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortOrder === "created") sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else sorted.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return sorted;
  }, [projects, query, sortOrder]);

  const openProjectHref = projects[0] ? `/studio/${projects[0].id}` : "/studio/demo";

  return (
    <main className="app-shell dashboard-shell">

      {/* ═══════════════════════════════
          LEFT SIDEBAR RAIL
          ═══════════════════════════════ */}
      <aside className="app-rail">
        <span className="rail-logo" aria-hidden="true"><Layers3 size={17} /></span>
        <nav className="rail-nav" aria-label="Main navigation">
          <Link href="/" className="rail-link active">
            <Home size={18} /><span className="rail-link-label">Home</span>
          </Link>
          <Link href="/#recent-projects" className="rail-link">
            <FolderOpen size={18} /><span className="rail-link-label">Projects</span>
          </Link>
          <Link href="/studio/demo" className="rail-link">
            <SquareDashed size={18} /><span className="rail-link-label">2D Editor</span>
          </Link>
          <Link href="/studio/demo/3d" className="rail-link">
            <Box size={18} /><span className="rail-link-label">3D Studio</span>
          </Link>
          <Link href="/new-design" className="rail-link">
            <Plus size={18} /><span className="rail-link-label">Create</span>
          </Link>
          <Link href="/library" className="rail-link">
            <LayoutGrid size={18} /><span className="rail-link-label">Designs</span>
          </Link>
        </nav>
        <div className="rail-bottom">
          <button className="rail-link" aria-label="Help"><CircleHelp size={18} /><span className="rail-link-label">Help</span></button>
          <button className="rail-link" aria-label="Settings"><Settings2 size={18} /><span className="rail-link-label">Settings</span></button>
        </div>
      </aside>

      {/* ═══════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════ */}
      <div className="dashboard-content">

        {/* ── Topbar ── */}
        <header className="workspace-topbar">
          <Link href="/" className="wordmark">
            <Image src="/wordmark.png" alt="NEXORA" width={900} height={129} className="wordmark-text" priority />
          </Link>
          <button className="topbar-center">
            <span className="workspace-dot" />
            Personal workspace
            <ChevronDown size={15} strokeWidth={1.8} />
          </button>
          <div className="topbar-search-wrap">
            <label className="search-field">
              <Search size={16} strokeWidth={1.8} />
              <input type="search" placeholder="Search projects..." value={query}
                onChange={e => setQuery(e.target.value)} aria-label="Search projects" />
            </label>
            <button className="icon-button" aria-label="Preferences"><Settings2 size={17} strokeWidth={1.9} /></button>
            <AccountMenu />
          </div>
        </header>

        {/* ── Dashboard body ── */}
        <div className="dashboard-inner">
          <div className="dashboard-body">

            {/* ════ HERO SECTION ════ */}
            <section className="hero-section">

              {/* Left: copy */}
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-dot" />YOUR CREATIVE WORKSPACE</div>
                <h1>Every great space<br /><em>starts with an idea.</em></h1>
                <p className="welcome-copy">Design floor plans, shape your spaces, and bring your vision to life in 3D.</p>
                <div className="welcome-actions">
                  <Link className="button primary create-button" href="/new-design">
                    <Plus size={16} strokeWidth={2} /> Create a design <ArrowUpRight size={14} strokeWidth={2} />
                  </Link>
                  <Link className="button open-project-btn" href={openProjectHref}>
                    <FolderOpen size={19} strokeWidth={1.8} /> Open a project
                  </Link>
                  <Link className="button open-project-btn" href="/library">
                    <LayoutGrid size={19} strokeWidth={1.8} /> Browse designs
                  </Link>
                </div>
                <div className="hero-chips">
                  <div className="hero-chip">
                    <span className="hero-chip-icon"><RefreshCw size={16} strokeWidth={1.8} /></span>
                    <span className="chip-text">Design in 2D &amp; 3D<small>From plan to realistic view</small></span>
                  </div>
                  <div className="hero-chip">
                    <span className="hero-chip-icon"><LayoutGrid size={16} strokeWidth={1.8} /></span>
                    <span className="chip-text">Customizable layouts<small>Tailor every detail</small></span>
                  </div>
                  <div className="hero-chip">
                    <span className="hero-chip-icon"><Heart size={16} strokeWidth={1.8} /></span>
                    <span className="chip-text">Beautiful results<small>Visualize before you build</small></span>
                  </div>
                </div>
              </div>

              {/* Right: hero image */}
              <div className="hero-image-wrap">
                {/* Desktop photo has a cleared patch under the card; the mobile crop excludes it. */}
                <Image className="hero-img-desktop" src="/images/hero-villa-aurora.jpg"
                  alt="Modern two-storey villa with a blueprint sketch" fill priority sizes="910px" quality={80} />
                <Image className="hero-img-mobile" src="/images/hero-villa-aurora-mobile.jpg"
                  alt="" fill sizes="100vw" quality={80} />

                {/* Floating info card */}
                <div className="hero-float-card" aria-hidden="true">
                  <div className="hero-float-top">
                    <div>
                      <p className="hero-float-title">Villa Aurora</p>
                      <p className="hero-float-meta">3 BHK<i>•</i>2 Floors<i>•</i>1,850 sq ft</p>
                    </div>
                  </div>
                  <div className="hero-float-bottom">
                    <div className="hero-float-avatars">
                      {EXAMPLE_PROJECTS.map(ex => (
                        <span key={ex.name} style={{backgroundImage:`url(${ex.image})`}} />
                      ))}
                    </div>
                    <div className="hero-float-right"><ArrowRight size={15} strokeWidth={2} /></div>
                  </div>
                </div>
              </div>
            </section>

            {/* ════ START CREATING ════ */}
            <section className="start-creating-section">
              <div className="section-header">
                <div>
                  <h2>Start creating</h2>
                  <p>Choose how you want to bring your space to life.</p>
                </div>
                <span className="subtle-label">YOUR NEXT STEP</span>
              </div>

              <div className="quick-grid">
                <Link className="quick-card qc-1" href="/new-design">
                  <span className="qc-icon"><SquarePen size={20} strokeWidth={1.8} /></span>
                  <h3>Start from a brief</h3>
                  <p>Share your plot size, room needs, floors and style to get a guided layout.</p>
                  <span className="quick-card-footer">GUIDED SETUP <ArrowRight size={13} strokeWidth={2} /></span>
                </Link>

                <Link className="quick-card qc-2" href="/studio/demo">
                  <span className="qc-icon"><SquareDashed size={20} strokeWidth={1.8} /></span>
                  <h3>Open the 2D editor</h3>
                  <p>Work with room layouts, dimensions and spatial relationships on a plan canvas.</p>
                  <span className="quick-card-footer">PLAN EDITOR <ArrowRight size={13} strokeWidth={2} /></span>
                </Link>

                <Link className="quick-card qc-3" href="/studio/demo/3d">
                  <span className="qc-icon"><Box size={20} strokeWidth={1.8} /></span>
                  <h3>Explore in 3D</h3>
                  <p>Move from a flat layout into a spatial view of your home concept.</p>
                  <span className="quick-card-footer">SPATIAL VIEW <ArrowRight size={13} strokeWidth={2} /></span>
                </Link>
              </div>
            </section>

            {/* ════ RECENT PROJECTS ════ */}
            <section className="projects-section" id="recent-projects">
              <div className="section-header">
                <div>
                  <h2>Recent projects</h2>
                  <p>Your saved designs, pulled live from the NEXORA API.</p>
                </div>
                <div className="section-header-actions">
                  {state === "ready" && projects.length > 1 && (
                    <label className="sort-select">
                      Sort
                      <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)}>
                        <option value="updated">Last edited</option>
                        <option value="name">Name</option>
                        <option value="created">Date created</option>
                      </select>
                    </label>
                  )}
                  <Link className="text-link" href={openProjectHref}>
                    Open workspace <ArrowUpRight size={14} strokeWidth={2} />
                  </Link>
                </div>
              </div>

              {actionError && (
                <div className="action-error-banner">
                  <AlertCircle size={14} /> {actionError}
                  <button onClick={() => setActionError("")} aria-label="Dismiss">×</button>
                </div>
              )}

              {/* Loading skeleton */}
              {state === "loading" && (
                <div className="project-grid">
                  {[0,1,2,3].map(i => (
                    <div className="skeleton-card" key={i}>
                      <div className="skeleton-art" />
                      <div className="skeleton-line" />
                      <div className="skeleton-line short" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {state === "error" && (
                <div className="error-state">
                  <AlertCircle size={22} />
                  <h3>Couldn&apos;t load your projects</h3>
                  <p>{errorMessage}</p>
                  <button className="button" onClick={() => setReloadKey(k => k+1)}><RefreshCw size={13} /> Try again</button>
                </div>
              )}

              {/* Empty — show example gallery */}
              {state === "ready" && projects.length === 0 && (
                <div className="project-grid">
                  {EXAMPLE_PROJECTS.map(ex => <ExampleCard key={ex.name} ex={ex} />)}
                </div>
              )}

              {/* No search match */}
              {state === "ready" && projects.length > 0 && filteredProjects.length === 0 && (
                <div className="empty-state">
                  <Search size={22} />
                  <h3>No projects match &ldquo;{query}&rdquo;</h3>
                  <p>Try a different name, or start a brand new design.</p>
                  <Link className="button primary" href="/new-design"><Plus size={14} /> Create a design</Link>
                </div>
              )}

              {/* Real projects */}
              {state === "ready" && filteredProjects.length > 0 && (
                <div className="project-grid">
                  {filteredProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onRenamed={updated => setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))}
                      onDuplicated={copy => setProjects(prev => [copy, ...prev])}
                      onDeleted={id => setProjects(prev => prev.filter(p => p.id !== id))}
                      onError={setActionError}
                    />
                  ))}
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
