package sync

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"github.com/gataky/sync/pkg/models"
)

// ankiMediaDir returns the path to Anki's media folder for a profile ("User 1" if empty),
// or "" if it can't be determined on this platform.
func ankiMediaDir(profile string) string {
	if profile == "" {
		profile = "User 1"
	}

	var baseDir string
	switch runtime.GOOS {
	case "darwin":
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		baseDir = filepath.Join(homeDir, "Library", "Application Support", "Anki2")
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return ""
		}
		baseDir = filepath.Join(appData, "Anki2")
	case "linux":
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		baseDir = filepath.Join(homeDir, ".local", "share", "Anki2")
	default:
		return ""
	}

	return filepath.Join(baseDir, profile, "collection.media")
}

// providerSource returns the code for the TTS provider used in audio filenames:
// "etts" for ElevenLabs (the default), "gtts" for Google TTS, or "" if unknown.
func providerSource(cfg *models.TTSConfig) string {
	if cfg == nil {
		return ""
	}
	switch strings.ToLower(cfg.Provider) {
	case "", "elevenlabs":
		return "etts"
	case "google":
		return "gtts"
	default:
		return ""
	}
}

// wordAudioFilename is the name of a word's audio file: {word}-{source}-{version}.mp3.
func wordAudioFilename(word, source string, version int) string {
	return fmt.Sprintf("%s-%s-%d.mp3", word, source, version)
}

// mediaLibrary is Anki's media folder, read directly from disk. An empty path means it can't be
// found, so nothing exists.
type mediaLibrary string

// exists reports whether a file is in the media folder.
func (m mediaLibrary) exists(filename string) bool {
	if m == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(string(m), filename))
	return err == nil
}

// latestWordAudio returns the newest versioned audio file for a word and its version, or ("", 0).
func (m mediaLibrary) latestWordAudio(word, source string) (string, int) {
	if m == "" {
		return "", 0
	}
	files, err := os.ReadDir(string(m))
	if err != nil {
		return "", 0
	}

	prefix := fmt.Sprintf("%s-%s-", word, source)
	latest, maxVersion := "", 0
	for _, file := range files {
		name := file.Name()
		if !strings.HasPrefix(name, prefix) || !strings.HasSuffix(name, ".mp3") {
			continue
		}
		version, err := strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(name, prefix), ".mp3"))
		if err != nil {
			continue
		}
		if version > maxVersion {
			latest, maxVersion = name, version
		}
	}
	return latest, maxVersion
}

// wordAudio returns a word's existing audio file: the legacy {word}.mp3 if there is one, else the
// newest versioned file, else "".
func (m mediaLibrary) wordAudio(word, source string) string {
	if legacy := word + ".mp3"; m.exists(legacy) {
		return legacy
	}
	latest, _ := m.latestWordAudio(word, source)
	return latest
}
