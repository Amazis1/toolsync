# MCP-Server-Konfiguration
#
# WICHTIG: Die YAML-Dateien in diesem Ordner enthalten Zugangsdaten und sind
# deshalb über .gitignore von der Versionierung ausgeschlossen.
#
# Secrets stehen NICHT in den Dateien, sondern werden aus Umgebungsvariablen
# eingesetzt. Einmalig einrichten:
#
#   setx GITHUB_TOKEN "DEIN_TOKEN"
#   setx CONTEXT7_API_KEY "DEIN_KEY"
#   setx TAVILY_API_KEY "DEIN_KEY"
#
# Danach VS Code neu starten.
#
# ---------------------------------------------------------------------------
# ACHTUNG - Zugangsdaten sind kompromittiert
# ---------------------------------------------------------------------------
# GitHub-Token, Context7-Key und Tavily-Key standen im Klartext in diesen
# Dateien und waren über Git versioniert (git ls-files bestätigte das).
#
# Die Keys müssen deshalb als kompromittiert gelten und widerrufen werden:
#   - GitHub:  https://github.com/settings/tokens
#   - Context7: beim Anbieter neu erzeugen
#   - Tavily:  https://app.tavily.com
#
# Das Entfernen aus dem Arbeitsverzeichnis reicht NICHT. Die Werte bleiben in
# der Git-Historie und in jedem Klon des Repos lesbar, bis sie widerrufen sind.
#
# ---------------------------------------------------------------------------
# Entfernt
# ---------------------------------------------------------------------------
# formatter.yaml wurde gelöscht. Sie nutzte
# "@modelcontextprotocol/server-everything" - den MCP-Referenzserver zum
# Testen der MCP-Anbindung selbst. Er hat keinen Nutzen für dieses Projekt.
