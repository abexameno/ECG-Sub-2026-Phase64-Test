import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
 children: ReactNode;
}

interface State {
 hasError: boolean;
 error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
 public state: State = {
 hasError: false,
 error: null
 };

 public static getDerivedStateFromError(error: Error): State {
 return { hasError: true, error };
 }

 public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
 console.error('Uncaught error:', error, errorInfo);
 }

 public render() {
 if (this.state.hasError) {
 let errorMessage = "Something went wrong.";
 try {
 if (this.state.error?.message) {
 const parsedError = JSON.parse(this.state.error.message);
 if (parsedError.error) {
 errorMessage = `Firestore Error: ${parsedError.error} (${parsedError.operationType} on ${parsedError.path})`;
 }
 }
 } catch (e) {
 errorMessage = this.state.error?.message || errorMessage;
 }

 return (
 <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
 <div className="bg-white p-8 rounded-xl max-w-md w-full border border-slate-200">
 <h2 className="text-2xl font-bold text-red-600 mb-4">Application Error</h2>
 <p className="text-gray-700 mb-6">
 {errorMessage}
 </p>
 <button
 onClick={() => window.location.reload()}
 className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded transition-colors"
 >
 Reload Application
 </button>
 </div>
 </div>
 );
 }

 return this.props.children;
 }
}

export default ErrorBoundary;
