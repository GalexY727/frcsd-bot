const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { loadReactionMap } = require("../../utils/reactionutils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("showmap")
        .setDescription("Display the current reaction map"),
    async execute(interaction) {

        // Check if the user has administrator permissions
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

        // Convert the reaction map object to a readable JSON string
        let reactionMap = loadReactionMap();
        const mapString = JSON.stringify(reactionMap, null, 2);
        // Reply to the interaction with the reaction map
        await interaction.reply(`\`\`\`json\n${mapString}\n\`\`\``);
    },
};