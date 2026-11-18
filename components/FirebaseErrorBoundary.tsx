'use client';

import {AlertTriangle, RotateCcw} from 'lucide-react';
import React from 'react';

interface FirebaseErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class FirebaseErrorBoundary extends React.Component<
  {children: React.ReactNode},
  FirebaseErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): FirebaseErrorBoundaryState {
    let readable = 'Ocorreu uma falha inesperada ao sincronizar os dados.';
    try {
      const parsed = JSON.parse(error.message) as {error?: string; path?: string};
      if (parsed?.error) {
        if (parsed.error.toLowerCase().includes('quota exceeded')) {
          readable =
            'O limite diário gratuito de leituras/gravações do Firestore foi atingido. O limite será renovado automaticamente amanhã.';
        } else if (parsed.error.toLowerCase().includes('permission')) {
          readable =
            'Permissão negada pelas regras de segurança do Firebase para esta ação. Verifique se você está conectado com sua conta verificada.';
        } else {
          readable = parsed.error;
        }
      }
    } catch {
      if (error.message) {
        readable = error.message;
      }
    }

    return {hasError: true, message: readable};
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-6 space-y-4 text-center">
            <AlertTriangle className="h-9 w-9 text-[#F7931E] mx-auto" />
            <h2 className="font-display text-xl font-bold">
              Não foi possível concluir a operação
            </h2>
            <p className="text-sm text-[#E5E5E5]/80 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({hasError: false, message: ''})}
              className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Tentar novamente</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
