const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { loadReactionMap, gitCommit, reactionMapPath } = require("../../utils/reactionutils");
const fs = require("fs");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("updatemap")
        .setDescription("Update the reaction map")
        .addStringOption((option) =>
            option
                .setName("keyword")
                .setDescription("The keyword to update")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("emoji")
                .setDescription("The emoji to associate with the keyword")
                .setRequired(true)
        ),
    async execute(interaction) {
        const keyword = interaction.options.getString("keyword");
        const emoji = interaction.options.getString("emoji");

        if (
            !interaction.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to use this command.",
                ephemeral: true,
            });
        }

        let reactionMap = loadReactionMap();
        try {
            reactionMap[keyword] = emoji;
            fs.writeFileSync(
                reactionMapPath,
                JSON.stringify(reactionMap, null, 2)
            );

            await interaction.reply({
                content: `Updating Keyword: ${keyword} with Emoji: ${emoji}...`,
                fetchReply: true,
            });

            // Attempt git commit and get success status
            const success = await gitCommit(keyword, emoji);

            // Edit the initial reply based on the success status
            const replyMessage = await interaction.fetchReply();
            if (success) {
                await replyMessage.edit(
                    `Successfully updated Keyword: ${keyword} with Emoji: ${emoji}`
                );
                await replyMessage.react("✅");
            } else {
                await replyMessage.edit(
                    `Updated Keyword: ${keyword} but failed to push changes.`
                );
                await replyMessage.react("❌");
            }
        } catch (error) {
            console.error("Error updating reactionMap.json", error);
            const replyMessage = await interaction.fetchReply();
            await replyMessage.edit("Failed to update the reaction map.");
            await replyMessage.react("❌");
        }
    },
};