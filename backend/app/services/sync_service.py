import os
import sys
import subprocess
from datetime import datetime


class SyncService:
    def __init__(self):
        self.process = None
        self.last_sync = None
        self.status = "idle"

    def start_sync_server(self, host: str, port: int, base: str, user: str):
        if self.process is None:
            env = os.environ.copy()
            # Ensure base path exists
            os.makedirs(base, exist_ok=True)
            env["SYNC_BASE"] = os.path.abspath(base)
            env["SYNC_HOST"] = host
            env["SYNC_PORT"] = str(port)
            env["SYNC_USER1"] = user

            try:
                self.process = subprocess.Popen(
                    [sys.executable, "-m", "anki.syncserver"],
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                print(f"[SyncServer] Servidor de sync iniciado en {host}:{port}")
            except Exception as e:
                print(f"[SyncServer] Error al iniciar servidor de sync: {e}")

    def stop_sync_server(self):
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=3)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            self.process = None
            print("[SyncServer] Servidor de sync detenido")

    def trigger_sync(self, collection_manager):
        self.status = "syncing"
        try:
            collection_manager.close_for_sync()
            self.last_sync = datetime.now().isoformat()
            self.status = "idle"
            collection_manager.reopen_after_sync()
            return True, "Sincronización completada exitosamente"
        except Exception as e:
            self.status = "error"
            collection_manager.reopen_after_sync()
            return False, str(e)

    def get_status(self):
        return self.status, self.last_sync
