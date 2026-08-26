import React from 'react';
import { Download, Sparkles, X, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface VersionInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  releaseDate: string;
}

interface VersionUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersionInfo: VersionInfo;
  onDismissVersion: (version: string) => void;
  themeColor: 'emerald' | 'blue' | 'indigo' | 'violet' | 'amber' | 'rose' | 'slate';
}

export const VersionUpdateModal: React.FC<VersionUpdateModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
  latestVersionInfo,
  onDismissVersion,
  themeColor,
}) => {
  if (!isOpen) return null;

  // Custom theme classes
  const accentTextColors = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    indigo: 'text-indigo-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    slate: 'text-slate-300',
  };

  const accentBgColors = {
    emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    blue: 'bg-blue-600 hover:bg-blue-500 text-white',
    indigo: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    violet: 'bg-violet-600 hover:bg-violet-500 text-white',
    amber: 'bg-amber-600 hover:bg-amber-500 text-[#0F1115]',
    rose: 'bg-rose-600 hover:bg-rose-500 text-white',
    slate: 'bg-slate-600 hover:bg-slate-500 text-white',
  };

  const accentBorderColors = {
    emerald: 'border-emerald-500/20',
    blue: 'border-blue-500/20',
    indigo: 'border-indigo-500/20',
    violet: 'border-violet-500/20',
    amber: 'border-amber-500/20',
    rose: 'border-rose-500/20',
    slate: 'border-slate-500/20',
  };

  const activeText = accentTextColors[themeColor] || accentTextColors.emerald;
  const activeBg = accentBgColors[themeColor] || accentBgColors.emerald;
  const activeBorder = accentBorderColors[themeColor] || accentBorderColors.emerald;

  const handleSkipVersion = () => {
    onDismissVersion(latestVersionInfo.version);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-[#161B22] border border-[#1E293B] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="p-6 border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-slate-800 border ${activeBorder}`}>
              <RefreshCw className={`w-5 h-5 ${activeText} animate-spin-slow`} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                New Application Update Available <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                A newer build has been published on the remote config server.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close Update Dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          
          {/* Version comparison row */}
          <div className="grid grid-cols-2 gap-3 bg-[#0F1115] border border-[#1E293B] p-3.5 rounded-xl text-center">
            <div>
              <div className="text-[9px] text-slate-500 uppercase font-black">Your Current Build</div>
              <div className="text-base font-mono font-black text-slate-400 mt-1">{currentVersion}</div>
            </div>
            <div className="border-l border-[#1E293B]">
              <div className="text-[9px] text-slate-500 uppercase font-black">Latest Remote Release</div>
              <div className={`text-base font-mono font-black mt-1 ${activeText}`}>
                {latestVersionInfo.version}
              </div>
            </div>
          </div>

          {/* Release Date info bar */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-[#1E293B]/40">
            <span className="font-semibold">Release Date:</span>
            <span className="font-mono text-slate-200">{latestVersionInfo.releaseDate || 'August 22, 2026'}</span>
          </div>

          {/* Release Notes */}
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className={`w-3.5 h-3.5 ${activeText}`} /> What's New in this Version:
            </h3>
            <div className="bg-[#0F1115] border border-[#1E293B] p-4 rounded-xl max-h-40 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
              {latestVersionInfo.releaseNotes}
            </div>
          </div>

          {/* Call to Action Information */}
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Downloading the file will fetch the compiled package. For local Windows PC environments, you can also fetch the updated repository files and compile them into your own whitelabeled <code className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-300">.exe</code> setup wrapper!
          </p>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0F1115] border-t border-[#1E293B] flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={handleSkipVersion}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all font-sans text-center"
          >
            Skip/Dismiss Version
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-xl transition-all font-sans text-center"
          >
            Update Later
          </button>

          <a
            href={latestVersionInfo.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 font-sans ${activeBg}`}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap shrink-0">Download Installer</span>
          </a>
        </div>

      </div>
    </div>
  );
};
