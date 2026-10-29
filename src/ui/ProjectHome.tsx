import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/db';
import { holdProjectLock } from '../db/locks';
import { createProject, deleteAllData, deleteProject } from '../db/projects';
import { accuratePackEnabled } from '../engine/models';
import type { ModelPack } from '../engine/constants';
import { LICENSE_NOTICE, PRIVACY_STATEMENT, RESPONSIBILITY } from '../gate/copy';
import { parseBackup } from '../db/backup';
import { importBackup } from '../scan/importBackup';
import { useUi } from './store';

export function ProjectHome() {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), []);
  const [name, setName] = useState('');
  const [pack, setPack] = useState<ModelPack>('fast');
  const [error, setError] = useState<string | null>(null);
  const [backupText, setBackupText] = useState<string | null>(null);
  const [importPack, setImportPack] = useState<ModelPack>('fast');
  const lockMessage = useUi((state) => state.lockMessage);
  const setProject = useUi((state) => state.setProject);
  const setLockMessage = useUi((state) => state.setLockMessage);
  const accurate = accuratePackEnabled();

  async function open(id: string) {
    const lock = await holdProjectLock(id);
    if (lock === 'busy') {
      setLockMessage('This project is already open in another tab.');
      return;
    }
    await db.photos
      .where('[projectId+status]')
      .equals([id, 'processing'])
      .modify({ status: 'pending' });
    setLockMessage(null);
    setProject(id);
  }

  return (
    <main className="page">
      <header className="top">
        <div>
          <p className="brand">Redact Faces</p>
          <h1>School-year projects</h1>
        </div>
      </header>
      <p className="responsibility">{RESPONSIBILITY}</p>
      {lockMessage ? <p className="banner">{lockMessage}</p> : null}
      {error ? <p className="banner danger">{error}</p> : null}
      <section className="card">
        <h2>New project</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createProject(name, pack)
              .then((id) => open(id))
              .catch((reason: unknown) =>
                setError(
                  reason instanceof Error ? reason.message : 'Could not create the project.',
                ),
              );
          }}
        >
          <label>
            School year or name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <fieldset>
            <legend>Model pack</legend>
            <label>
              <input
                type="radio"
                name="pack"
                checked={pack === 'fast'}
                onChange={() => setPack('fast')}
              />{' '}
              Fast
            </label>
            {accurate ? (
              <label>
                <input
                  type="radio"
                  name="pack"
                  checked={pack === 'accurate'}
                  onChange={() => setPack('accurate')}
                />{' '}
                Accurate
              </label>
            ) : null}
          </fieldset>
          <button type="submit">Create project</button>
        </form>
      </section>
      <section className="card">
        <h2>Projects</h2>
        <ul className="plain">
          {(projects ?? []).map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => void open(project.id)}>
                {project.name}
              </button>
              <span className="muted">{project.modelPack}</span>
              <button type="button" onClick={() => void deleteProject(project.id)}>
                Delete project
              </button>
            </li>
          ))}
        </ul>
        {projects?.length === 0 ? <p>No projects yet.</p> : null}
      </section>
      <section className="card">
        <h2>Import a backup</h2>
        <p>The file contains student names and consent. Treat it as sensitive data.</p>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              const parsed = parseBackup(JSON.parse(text) as unknown);
              if (!parsed.success) {
                setError('That backup file is not valid.');
                setBackupText(null);
                return;
              }
              setBackupText(text);
              setError(null);
            });
          }}
        />
        {backupText ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = parseBackup(JSON.parse(backupText) as unknown);
              if (!parsed.success) return;
              void window
                .showDirectoryPicker({ mode: 'read' })
                .then((dir) => importBackup(parsed.data, importPack, dir))
                .then(async (result) => {
                  if (result.unmatched.length > 0) {
                    setError(
                      `Imported. These photos did not match a file: ${result.unmatched.join(', ')}`,
                    );
                  }
                  await open(result.id);
                })
                .catch((reason: unknown) =>
                  setError(reason instanceof Error ? reason.message : 'Import failed.'),
                );
            }}
          >
            <fieldset>
              <legend>Model pack for the new embeddings</legend>
              <label>
                <input
                  type="radio"
                  checked={importPack === 'fast'}
                  onChange={() => setImportPack('fast')}
                />{' '}
                Fast
              </label>
              {accurate ? (
                <label>
                  <input
                    type="radio"
                    checked={importPack === 'accurate'}
                    onChange={() => setImportPack('accurate')}
                  />{' '}
                  Accurate
                </label>
              ) : null}
            </fieldset>
            <button type="submit">Choose photo folder and import</button>
          </form>
        ) : null}
      </section>
      <section className="card">
        <h2>Delete all data</h2>
        <DeleteAll />
      </section>
      <footer className="legal">
        <p>{PRIVACY_STATEMENT}</p>
        <p>{LICENSE_NOTICE}</p>
      </footer>
    </main>
  );
}

function DeleteAll() {
  const [phrase, setPhrase] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (phrase !== 'DELETE') return;
        void deleteAllData();
      }}
    >
      <p>
        This deletes projects, names, consent, and folder access on this browser. Model downloads
        stay cached.
      </p>
      <label>
        Type DELETE
        <input value={phrase} onChange={(event) => setPhrase(event.target.value)} />
      </label>
      <button type="submit" disabled={phrase !== 'DELETE'}>
        Delete all data
      </button>
    </form>
  );
}
