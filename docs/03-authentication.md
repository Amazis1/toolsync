# ToolSync – Authentifizierung und Berechtigungen

> **Verbindliche fachliche Quelle:** `docs/01-requirements.md` Abschnitte 2 und 15
> **Verbindliche Entscheidungen:** `docs/13-decisions.md` (DEC-030, DEC-031, DEC-032, DEC-033)
> **Code:** `backend/app/routers/auth.py`, `app/services/auth_service.py`,
> `app/dependencies/auth.py`, `app/dependencies/permissions.py`, `app/core/security.py`

## 1. Zwei getrennte Logins

ToolSync hat **zwei** Login-Wege. Sie sind bewusst voneinander getrennt.

| | Normale Benutzer | Admin |
|---|---|---|
| Endpunkt | `POST /api/auth/login` | `POST /api/auth/admin/login` |
| Eingabe | Personalnummer | Personalnummer **und** Passwort |
| Passwort | **kein** Passwort, kein PIN | bcrypt-Hash in `users.hashed_password` |
| Selbstregistrierung | nicht möglich | — |
| Anlage | ausschließlich durch Admin | — |

### 1.1 Normaler Login (passwortlos)

`AuthService.login_user(personal_number)`:

1. Benutzer über `personal_number` laden.
2. Abbruch, wenn nicht vorhanden oder `is_active = False`.
3. **Abbruch, wenn `is_admin = True`.**

> **Wichtig:** Admin-Konten dürfen den passwortlosen Login **nicht** benutzen.
> Das ist im Code ausdrücklich abgesichert (`auth_service.py`, Kommentar
> „Admin-Konten duerfen NICHT ueber den passwortlosen Benutzer-Login").

4. JWT ausstellen mit `sub = personal_number` und `is_admin`.

### 1.2 Admin-Login (mit Passwort)

`AuthService.login_admin(personal_number, password)`:

1. Benutzer laden; Abbruch, wenn nicht vorhanden, nicht aktiv oder **nicht** `is_admin`.
2. Passwort gegen den bcrypt-Hash prüfen (`verify_password`).
3. JWT ausstellen mit `is_admin = True`.

Fehlermeldung bei beiden Wegen: HTTP 401 mit „Ungültige Personalnummer" bzw.
„Ungültige Personalnummer oder Passwort".

### 1.3 Logout

`POST /api/auth/logout` gibt `{"message": "Logged out successfully"}` zurück und
invalidiert **nichts** serverseitig.

> **Offen:** Es gibt keine Token-Sperrliste. Ein ausgestelltes JWT bleibt bis zum
> Ablauf gültig. Für einen echten Logout bräuchte es eine Sperrliste oder kurze
> Token mit Refresh-Verfahren.

## 2. JWT

| Eigenschaft | Wert |
|---|---|
| Algorithmus | `HS256` (`settings.jwt_algorithm`) |
| Secret | `settings.jwt_secret_key` |
| Lebensdauer | `settings.jwt_access_token_expire_minutes` = **30 Minuten** |
| Payload | `sub` (Personalnummer), `is_admin`, `exp` |
| Übertragung | `Authorization: Bearer <token>` |
| Schema | `OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)` |
| Bibliothek | `python-jose` 3.3.0 |

`auto_error=False` sorgt dafür, dass ein fehlender Token nicht von FastAPI, sondern
selbst behandelt wird — dadurch kommt eine saubere 401 statt einer 403.

> ### Sicherheitsbefund — behoben, aber Rotation offen
>
> **Der Befund:** `backend/app/core/config.py` hatte einen fest eingebauten Default
> `jwt_secret_key = "your-super-secret-key-change-me"`. Zusätzlich war `backend/.env`
> über Git **versioniert** und **nicht** in `.gitignore` — und enthielt genau diesen
> Default-Wert. Das Signatur-Secret lag damit im Klartext im Repository. Wer es
> kannte, konnte gültige Tokens für **jede** Personalnummer erzeugen, auch für Admins.
>
> **Was behoben wurde:**
> 1. `jwt_secret_key` ist jetzt ein **Pflichtfeld ohne Default**. Fehlt der Wert,
>    bricht der Start mit `ValidationError: jwt_secret_key Field required` ab
>    (verifiziert: Exit-Code 1). Ein lauter Startfehler statt eines stillen Fallbacks.
> 2. In `backend/.env` steht jetzt ein zufälliges Secret mit 64 Zeichen
>    (`secrets.token_urlsafe(48)`).
> 3. `backend/.env` ist per `git rm --cached` aus der Versionierung genommen und
>    über `.gitignore` ausgeschlossen (Datei bleibt lokal erhalten).
> 4. `backend/.env.example` ist angelegt und versioniert — mit leeren Werten und
>    Anleitung.
> 5. Der `env_file`-Pfad in `config.py` ist jetzt **absolut**
>    (`Path(__file__).parents[2] / ".env"`). Vorher stand dort `".env"`, was nur
>    funktionierte, wenn der Prozess aus `backend/` gestartet wurde — aus dem
>    Projektwurzelverzeichnis wurde die Datei stillschweigend nicht gefunden.
>
> **Was noch offen ist:**
>
> Das alte Secret steht weiterhin in der **Git-Historie**. Wer Zugriff auf das
> Repository oder einen Klon hat, kann es dort auslesen. Deshalb:
>
> - Wenn das Repository jemals gepusht oder geteilt wurde: **Secret als
>   kompromittiert behandeln** und rotieren (neuen Wert in `backend/.env` setzen;
>   die Historie muss dafür nicht umgeschrieben werden, weil das Secret ohnehin
>   neu ist). Alle ausgestellten Tokens werden durch die Rotation ungültig.
> - Prüfen, ob das Repository ein Remote hat und ob es öffentlich ist.
> - Der alte Default-Wert sollte nie wieder irgendwo verwendet werden.

## 3. Token-Prüfung

`backend/app/dependencies/auth.py`, `get_current_user`:

1. Token aus dem `Authorization`-Header lesen.
2. Fehlt er → 401 „Nicht authentifiziert" mit `WWW-Authenticate: Bearer`.
3. JWT dekodieren; bei `JWTError` → 401 „Ungültiger Token".
4. `sub` lesen; fehlt es → 401 „Ungültiger Token".
5. Benutzer aus der DB laden; nicht gefunden → 401 „Benutzer nicht gefunden".

> **Wichtig:** `get_current_user` prüft **nicht**, ob der Benutzer noch aktiv ist.
> Diese Prüfung liegt in `require_active`. Wer `get_current_user` direkt verwendet,
> lässt deaktivierte Benutzer durch.

### Der `is_admin`-Claim

Der JWT trägt `is_admin`, aber **keine** Autorisierungsentscheidung wird daraus
abgeleitet. `require_admin` prüft `user.is_admin` aus der **Datenbank**.

Das ist die sichere Variante: Wird einem Benutzer die Admin-Rolle entzogen, wirkt
das sofort, auch wenn er noch ein Token mit `is_admin: true` besitzt. Der Claim ist
damit nur Information, nicht Berechtigung.

## 4. Berechtigungsprüfung

`backend/app/dependencies/permissions.py` stellt zwei Abhängigkeiten bereit:

| Abhängigkeit | Prüft | Fehler |
|---|---|---|
| `require_active` | `user.is_active` | 403 „Benutzerkonto ist deaktiviert" |
| `require_admin` | `require_active` **und** `user.is_admin` | 403 „Administrator-Rechte erforderlich" |

`require_admin` baut auf `require_active` auf — ein Admin muss also auch aktiv sein.

### Verwendung

- `require_active`: alle geschützten Endpunkte für angemeldete Benutzer.
- `require_admin`: Benutzerverwaltung, Rollen, administrative Stammdaten.

### Grundregel

> **Wichtig:** Das Ausblenden eines Buttons im Frontend ist **keine**
> Sicherheitsmaßnahme. Jeder geschützte Endpunkt prüft serverseitig.

## 5. Rollen und Berechtigungen

| Modell | Tabelle | Felder |
|---|---|---|
| `Role` | `roles` | `id`, `name` (unique) |
| `Permission` | `permissions` | `id`, `name` (unique), `codename` (unique) |
| Verknüpfung | `role_permissions` | `role_id`, `permission_id` (n:m) |
| `User` | `users` | `role_id` (FK, `SET NULL`, nullable) |

> **Abweichung Code ↔ Doku:** Die Tabellen `roles`, `permissions` und
> `role_permissions` existieren, werden aber **nicht wirksam ausgewertet**.
> Die tatsächliche Autorisierung läuft ausschließlich über `User.is_admin`.
> Es gibt keinen Endpunkt, der `Role.permissions` prüft.
>
> Zusätzlich: `tasks` und `CURRENT_TASKS.md` halten fest, dass die Rollen im
> AdminPanel wieder **entfernt** wurden (TASK-010 Phase 1 und 2: `UserRead` ohne
> `role_id`, `AdminUsers` ohne Rollen-Dropdown). Rollen sind damit derzeit
> modelliert, aber nicht bedient.
>
> **Offen:** Sollen Rollen und Berechtigungen tatsächlich genutzt werden (DEC-033)
> oder bleibt `is_admin` die einzige Stufe? Die Entscheidung fehlt.

## 6. Benutzerfelder

`backend/app/models/user.py`:

| Feld | Typ | Regel |
|---|---|---|
| `id` | PK | — |
| `personal_number` | `String(50)` | **unique**, not null, indiziert |
| `first_name` | `String(100)` | not null |
| `last_name` | `String(100)` | not null |
| `display_name` | `String(200)` | nullable |
| `hashed_password` | `String(255)` | nullable (nur Admin braucht eins) |
| `is_active` | `Boolean` | not null, Default `True` |
| `is_admin` | `Boolean` | not null, Default `False` |
| `role_id` | FK `roles.id` | nullable, `ondelete="SET NULL"` |

Der Anzeigename wird aus Vorname und Nachname gebildet.

## 7. Was der Token nicht enthält

Kein Ablauf-Refresh, keine Rollen, keine Berechtigungsliste. Nur `sub`, `is_admin`
und `exp`. Jede Rechteentscheidung holt den Benutzer aus der Datenbank.

## 8. Offene Fragen

1. **Secret-Rotation** — das alte Secret steht in der Git-Historie. Prüfen, ob das
   Repository je gepusht wurde, und das Secret bei Bedarf für kompromittiert erklären.
   Siehe Sicherheitsbefund in Abschnitt 2.
2. **Logout ohne Wirkung** — braucht es eine Sperrliste oder kurze Tokens mit Refresh?
3. **`is_active` in `get_current_user`** — soll die Prüfung dort hinein, damit kein
   Aufrufer sie vergessen kann?
4. **Rollen** — werden `Role`/`Permission` genutzt oder nicht? Wenn nicht: entfernen.
   Derzeit ist `is_admin` die einzige wirksame Stufe.
5. **Token-Lebensdauer 30 Minuten** — für einen Werkstattbetrieb an einem Terminal
   möglicherweise zu kurz oder zu lang. Fachliche Klärung nötig.
6. **CORS** — fest auf `localhost:5173` und `localhost:3000` verdrahtet. Für
   Serverbetrieb im internen Netzwerk konfigurierbar machen.
7. **`DATABASE_URL`** — zeigt aktuell auf SQLite (`sqlite+aiosqlite`), nicht auf
   PostgreSQL. Für die Entwicklung in Ordnung, für den Betrieb muss das umgestellt
   werden.