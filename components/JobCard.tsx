"use client";

import React from "react";
import { Bookmark, BookmarkCheck, Trash2, MapPin, Check, Minus, X, Send } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
	ScoreRing,
	displayMatchScore,
	isAiCalibrated,
} from "@/components/ScoreRing";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useI18n } from "@/components/I18nProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";

export interface JobCardProps {
	job: {
		id: string;
		title: string;
		company: string;
		companyWebsite?: string | null;
		companyLogo?: string | null;
		location?: string | null;
		remoteType: string;
		salaryMin?: number | null;
		salaryMax?: number | null;
		salaryCurrency?: string | null;
		technologies?: string | null;
		postedAt?: string | Date | null;
		viewCount?: number | null;
		source?: string | null;
		sourceLabels?: string[];
		match?: {
			matchScore: number;
			strongMatches: string;
			possibleIssues: string;
			missingSkills: string;
			aiInterpretation?: string | null;
			triageStatus?: string | null;
			triageReason?: string | null;
		} | null;
		application?: {
			status: string;
		} | null;
	};
  onSaveToggle?: (jobId: string, isSaved: boolean) => void;
  onDelete?: (jobId: string) => void;
  onOpen?: (jobId: string) => void;
  selected?: boolean;
  selectMode?: boolean;
  onSelectToggle?: (jobId: string, extendRange?: boolean) => void;
}

function parseJsonArray(str?: string | null): string[] {
	if (!str) return [];
	try {
		return JSON.parse(str);
	} catch {
		return [];
	}
}

function JobCardInner({ job, onSaveToggle, onDelete, onOpen, selected = false, selectMode = false, onSelectToggle }: JobCardProps) {
	const { t } = useI18n();
	const confirm = useConfirm();
	const isSaved = job.application?.status === "SAVED";

	const strongMatches = parseJsonArray(job.match?.strongMatches);
	const techs = parseJsonArray(job.technologies);

	const open = (e?: React.SyntheticEvent) => {
		e?.stopPropagation();
		onOpen?.(job.id);
	};

	const handleSave = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const newStatus = isSaved ? "NEW" : "SAVED";
		try {
			const res = await fetch("/api/applications", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jobId: job.id, status: newStatus }),
			});
			if (res.ok && onSaveToggle) {
				onSaveToggle(job.id, !isSaved);
			}
		} catch (err) {
			console.error(err);
		}
	};

	const handleDelete = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const ok = await confirm({
			title: t("jobcard.deleteConfirm", {
				title: job.title,
				company: job.company,
			}),
			confirmLabel: t("jobcard.delete"),
			tone: "danger",
		});
		if (!ok) return;
		try {
			const res = await fetch(`/api/jobs/${job.id}`, {
				method: "DELETE",
			});
			if (res.ok && onDelete) {
				onDelete(job.id);
			}
		} catch (err) {
			console.error(err);
		}
	};

	const hasScore = Boolean(job.match);
	const score = displayMatchScore(job.match);
	const calibrated = isAiCalibrated(job.match);
	const triageStatus = job.match?.triageStatus || "UNREVIEWED";
	const triageLabel =
		triageStatus === "WORTH_APPLYING"
			? {
					text: t("jobcard.triageWorth"),
					Icon: Check,
					className:
						"border-emerald-300 bg-emerald-200 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
				}
			: triageStatus === "MAYBE"
				? {
						text: t("jobcard.triageMaybe"),
						Icon: Minus,
						className:
							"border-amber-300 bg-amber-200 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
					}
				: triageStatus === "SKIP"
					? {
							text: t("jobcard.triageSkip"),
							Icon: X,
							className: "border-red-300 bg-red-200 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
						}
					: null;

	let salaryStr = "";
	if (job.salaryMin || job.salaryMax) {
		const curr = job.salaryCurrency || "USD";
		if (job.salaryMin && job.salaryMax && job.salaryMin !== job.salaryMax) {
			salaryStr = `${formatCurrency(job.salaryMin, curr)} – ${formatCurrency(job.salaryMax, curr)}`;
		} else {
			salaryStr = formatCurrency(job.salaryMax || job.salaryMin, curr);
		}
	}

	const remoteLabel =
		job.remoteType !== "unknown"
			? job.remoteType === "remote"
				? t("discover.workplace.remote")
				: job.remoteType === "hybrid"
					? t("discover.workplace.hybrid")
					: t("discover.workplace.onsite")
			: null;

	// Highlights: the verdict/explanation line, or the strongest matches as bullets.
	const highlights = job.match?.triageReason || job.match?.aiInterpretation
		? [job.match?.triageReason || job.match?.aiInterpretation || ""]
		: strongMatches.slice(0, 3);

	return (
		<article
			onClick={(e) => {
				// In select mode a card click is a selection gesture, not an open.
				if (selectMode) {
					onSelectToggle?.(job.id, e.shiftKey);
					return;
				}
				onOpen?.(job.id);
			}}
			onKeyDown={(e) => {
				const tag = (e.target as HTMLElement).tagName;
				if (tag === "BUTTON" || tag === "INPUT" || tag === "A") return;
				if (selectMode && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					onSelectToggle?.(job.id, e.shiftKey);
					return;
				}
				if (e.key === "Enter") {
					e.preventDefault();
					onOpen?.(job.id);
				}
			}}
			tabIndex={0}
			aria-label={`${job.title} at ${job.company}${hasScore ? `, match ${score} percent` : ""}. ${t("jobcard.view")}`}
			className={cn(
				"group rounded-2xl sm:rounded-3xl border bg-card p-4 sm:p-5 cursor-pointer outline-none",
				"shadow-[0_12px_40px_-24px_rgba(19,20,23,0.25)]",
				"motion-safe:transition-colors motion-safe:duration-150 hover:border-primary/25 focus-visible:ring-2 focus-visible:ring-ring",
				triageStatus === "SKIP" && !selected && "opacity-75",
				selectMode && "select-none",
				selectMode && !selected && "hover:border-primary/40",
				selected && "border-primary/50 bg-primary/[0.04] ring-1 ring-primary/30",
			)}
		>
			<div className="flex gap-3 sm:gap-4">
				{selectMode && (
					<input
						type="checkbox"
						checked={selected}
						onChange={() => {}}
						onClick={(e) => {
							e.stopPropagation();
							onSelectToggle?.(job.id, e.shiftKey);
						}}
						aria-label={t("jobcard.select", { title: job.title })}
						className="mt-1 size-5 shrink-0 rounded-md border-input cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-ring"
					/>
				)}
				<CompanyLogo
					company={job.company}
					website={job.companyWebsite}
					directLogoUrl={job.companyLogo}
					size={56}
					className="shrink-0 rounded-2xl"
				/>
				<div className="min-w-0 flex-1">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div className="min-w-0">
							{triageLabel && (
								<span
									className={cn(
										"mb-2 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-5",
										triageLabel.className,
									)}
								>
									<triageLabel.Icon className="size-3.5 shrink-0" aria-hidden="true" />
									{triageLabel.text}
								</span>
							)}
							<h3 className="line-clamp-2 break-words text-[16px] leading-snug sm:text-[18px] font-bold text-foreground">
								{job.title}
							</h3>
							<p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
								<span className="font-semibold text-foreground/80">{job.company}</span>
								{job.location && (
									<span className="inline-flex min-w-0 items-center gap-1">
										<span aria-hidden="true">·</span>
										<MapPin className="size-3 shrink-0" aria-hidden="true" />
										<span className="truncate">{job.location}</span>
									</span>
								)}
								{remoteLabel && <span className="shrink-0">· {remoteLabel}</span>}
							</p>
						</div>

						<div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
							{hasScore ? (
								<ScoreRing score={score} size={40} calibrated={calibrated} />
							) : (
								<span className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
									{t("jobcard.unscored")}
								</span>
							)}
							<div className="flex items-center gap-1.5">
								<button
									type="button"
									onClick={open}
									className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90 motion-safe:transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none touch-manipulation"
								>
									<Send className="size-3.5" aria-hidden="true" />
									{t("jobcard.view")}
								</button>
								<button
									type="button"
									onClick={handleSave}
									aria-label={isSaved ? t("jobcard.unsave") : t("jobcard.save")}
									aria-pressed={isSaved}
									title={isSaved ? t("jobcard.unsave") : t("jobcard.save")}
									className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted motion-safe:transition-colors cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
								>
									{isSaved ? (
										<BookmarkCheck className="size-4 text-primary" aria-hidden="true" />
									) : (
										<Bookmark className="size-4" aria-hidden="true" />
									)}
								</button>
								<button
									type="button"
									onClick={handleDelete}
									aria-label={t("jobcard.delete")}
									title={t("jobcard.delete")}
									className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 motion-safe:transition-colors cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
								>
									<Trash2 className="size-4" aria-hidden="true" />
								</button>
							</div>
						</div>
					</div>

					{highlights.length > 0 && (
						<ul className="mt-3.5 space-y-1 text-[13px] leading-relaxed text-muted-foreground">
							{highlights.map((line) => (
								<li key={line} className="flex gap-2">
									<span aria-hidden="true" className="mt-[0.55em] size-1 shrink-0 rounded-full bg-primary" />
									<span className="min-w-0 line-clamp-2">{line}</span>
								</li>
							))}
						</ul>
					)}

					<div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3.5">
							{salaryStr && (
								<span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
									{salaryStr}
								</span>
							)}
							{techs.slice(0, 4).map((tech, index) => (
								<span
									key={tech}
									className={cn(
										"rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
										index >= 2 && "hidden sm:inline-flex",
									)}
								>
									{tech}
								</span>
							))}
							<span className="ml-auto text-xs tabular-nums text-muted-foreground">
								{t("jobcard.viewed", {
									count: job.viewCount || 0,
									unit: t(job.viewCount === 1 ? "jobcard.time" : "jobcard.times"),
								})}
							</span>
						</div>
				</div>
			</div>
		</article>
	);
}

export const JobCard = React.memo(JobCardInner);
