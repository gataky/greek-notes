package cli

import (
	"os"

	"github.com/gataky/sync/internal/sync"
	"github.com/spf13/cobra"
)

var verbsCmd = &cobra.Command{
	Use:   "verbs",
	Short: "Push the verb deck (forms and aspect cards) to Anki",
	Long: `Push the verb deck to Anki: a "Greek verb" note for each active verb in the sheet
(produce its past continuous, aorist and future, and recognise hard aorists) and a
"Greek aspect" cloze note for each of its past-tense sentences.

The forms, groups and sentences are read from greek-notes' exports/anki-verbs.json
(verbs.cards_path in the config); run ` + "`make sync`" + ` there first after adding verbs
to the sheet. Only notes whose content changed are updated, and nothing is deleted.`,
	RunE: runVerbs,
}

func init() {
	rootCmd.AddCommand(verbsCmd)
}

func runVerbs(cmd *cobra.Command, args []string) error {
	ctx, err := Bootstrap(BootstrapOptions{EnableTTS: true})
	if err != nil {
		return err
	}
	defer ctx.Close()

	pusher := sync.NewVerbPusher(ctx.SheetsClient, ctx.AnkiClient, ctx.TTSClient, ctx.Config, ctx.Logger, os.Stdout)
	if err := pusher.Push(getDryRun()); err != nil {
		return printError("verbs push failed: %w", err)
	}
	return nil
}
