import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan tak terduga pada aplikasi.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              Gangguan Sinkronisasi atau Tampilan
            </h1>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Aplikasi mengalami kesalahan saat memproses data. Anda dapat memuat ulang halaman
              untuk kembali ke ruang kerja.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 break-words mb-5">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="touch-target px-5 py-2.5 bg-sky-600 text-white text-sm font-semibold rounded-xl hover:bg-sky-700 transition-colors"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
