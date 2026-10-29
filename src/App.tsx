import { useEffect, useState } from 'react';
import { onDeviceLost } from './gate/device';
import { runCapabilityGate, type GateFailure, type GateSuccess } from './gate/runGate';
import { cancelScan } from './scan/runScan';
import { GateScreen } from './ui/GateScreen';
import { ProjectHome } from './ui/ProjectHome';
import { useUi } from './ui/store';
import { Workspace } from './ui/Workspace';

export function App() {
  const [gate, setGate] = useState<
    | { status: 'checking' }
    | { status: 'blocked'; failure: GateFailure }
    | { status: 'ready'; success: GateSuccess }
  >({ status: 'checking' });
  const projectId = useUi((state) => state.projectId);
  const setWarn = useUi((state) => state.setWarn);
  const setDeviceLost = useUi((state) => state.setDeviceLost);

  useEffect(() => {
    let cancelled = false;
    void runCapabilityGate().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setWarn(result.success.warnSlow, result.success.medianMs);
        setGate({ status: 'ready', success: result.success });
      } else {
        setGate({ status: 'blocked', failure: result.failure });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setWarn]);

  useEffect(() => {
    return onDeviceLost((message) => {
      cancelScan();
      setDeviceLost(message);
    });
  }, [setDeviceLost]);

  if (gate.status === 'checking') {
    return (
      <main className="gate">
        <h1>Checking this browser…</h1>
      </main>
    );
  }
  if (gate.status === 'blocked') {
    return (
      <GateScreen
        code={gate.failure.code}
        errorText={gate.failure.errorText}
        diagnostics={gate.failure.diagnostics}
      />
    );
  }
  return projectId ? <Workspace projectId={projectId} /> : <ProjectHome />;
}
