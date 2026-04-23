import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // @ts-ignore
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-12 bg-black/40 border border-red-500/20 rounded-3xl backdrop-blur-xl text-center space-y-6 max-w-md mx-auto my-20">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-white uppercase tracking-tight">Stage Engine Error</h2>
            <p className="text-xs text-white/40 font-mono leading-relaxed">
              The real-time rendering engine encountered an issue. <br />
              {this.state.error?.message}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-mono text-white/60 hover:text-white hover:border-brand-gold transition-all flex items-center gap-2 mx-auto"
          >
            <RotateCcw size={14} /> REINITIALIZE STAGE
          </button>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}
