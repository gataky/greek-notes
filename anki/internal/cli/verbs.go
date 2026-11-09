package cli

import (
	"os"

	"github.com/gataky/sync/internal/sync"
	"github.com/gataky/sync/pkg/models"
	"github.com/spf13/cobra"
)

var verbsCmd = &cobra.Command{
	Use:   "verbs",
	Short: "Push the verb deck (forms and aspect cards) to Anki",
	Long: `Push the verb deck to Anki: a "Greek verb" note for each active verb in the sheet
(produce its past continuous, aorist and future, and recognise hard aorists) and a
"Greek aspect" cloze note for each of its past-tense sentences.

The forms, groups and sentences are read from the repo's exports/anki-verbs.json
(--cards, else verbs.cards_path in the config). ` + "`make push-verbs`" + ` at the repo root
rebuilds it and passes its path. Only notes whose content changed are updated, and
nothing is deleted.`,
	RunE: runVerbs,
}

// cardsPath overrides verbs.cards_path in the config
var cardsPath string

func init() {
	verbsCmd.Flags().StringVar(&cardsPath, "cards", "", "Path to anki-verbs.json (overrides verbs.cards_path)")
	rootCmd.AddCommand(verbsCmd)
}

func runVerbs(cmd *cobra.Command, args []string) error {
	ctx, err := Bootstrap(BootstrapOptions{EnableTTS: true})
	if err != nil {
		return err
	}
	defer ctx.Close()

	if cardsPath != "" {
		if ctx.Config.Verbs == nil {
			ctx.Config.Verbs = &models.VerbsConfig{}
		}
		ctx.Config.Verbs.CardsPath = cardsPath
	}

	pusher := sync.NewVerbPusher(ctx.SheetsClient, ctx.AnkiClient, ctx.TTSClient, ctx.Config, ctx.Logger, os.Stdout)
	if err := pusher.Push(getDryRun()); err != nil {
		return printError("verbs push failed: %w", err)
	}
	return nil
}
