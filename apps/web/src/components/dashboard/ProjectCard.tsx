"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ApiError, deleteProject, duplicateProject, renameProject, type ProjectSummary } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { ProjectPlanPreview } from "@/components/dashboard/ProjectPlanPreview";

export function ProjectCard({
  project,
  onRenamed,
  onDuplicated,
  onDeleted,
  onError,
}: {
  project: ProjectSummary;
  onRenamed: (project: ProjectSummary) => void;
  onDuplicated: (project: ProjectSummary) => void;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    try {
      onRenamed(await renameProject(project.id, name.trim()));
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not rename this project.");
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    setBusy(true);
    try {
      onDuplicated(await duplicateProject(project.id));
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not duplicate this project.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteProject(project.id);
      onDeleted(project.id);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Could not delete this project.");
      setBusy(false);
    }
  };

  return (
    <Link href={`/studio/${project.id}`} className="project-card" aria-disabled={busy} onClick={(e) => busy && e.preventDefault()}>
      <div className="project-art">
        <ProjectPlanPreview plotWidth={project.plotWidth} plotLength={project.plotLength} roomCount={project.roomCount} />
        <span className="project-badge">{project.status.toUpperCase()}</span>
        <div className="project-menu" ref={menuRef}>
          <button
            className="project-more"
            aria-label={`More actions for ${project.name}`}
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen((o) => !o);
            }}
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="project-menu-dropdown">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  setRenaming(true);
                }}
              >
                <Pencil size={13} /> Rename
              </button>
              <button onClick={handleDuplicate}>
                <Copy size={13} /> Duplicate
              </button>
              <button className="danger" onClick={handleDelete}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="project-info">
        <div className="project-info-row">
          <div>
            {renaming ? (
              <input
                className="field project-rename-field"
                autoFocus
                defaultValue={project.name}
                onClick={(e) => e.preventDefault()}
                onBlur={(e) => handleRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setRenaming(false);
                }}
              />
            ) : (
              <h3>{project.name}</h3>
            )}
            <p>
              {project.roomCount} room{project.roomCount === 1 ? "" : "s"} · {project.plotWidth}×{project.plotLength} {project.units}
            </p>
          </div>
          <span className="project-open-btn">Open <ArrowRight size={12}/></span>
        </div>
        <span className="project-status">
          <i />
          {formatRelativeTime(project.updatedAt)}
        </span>
      </div>
    </Link>
  );
}
