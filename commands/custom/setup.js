const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection,
} = require("discord.js");
const { betterColor } = require("../../utils/colorUtil");
const { tba } = require("../../config.json");
const { createEmbed } = require("../../utils/embedBuilder");

const baseTbaUrl = "https://www.thebluealliance.com/api/v3/team/frc";
const baseColorUrl = "https://api.frc-colors.com/v1/team/";

/**
 * Fetches team data from The Blue Alliance API.
 * @param {number} number - The team number.
 * @returns {Promise<Object>} - A promise that resolves to the team data.
 */
async function fetchTeamData(number) {
    const fetch = (await import("node-fetch")).default;
    const tbaUrl = `${baseTbaUrl}${number}/simple`;
    const response = await fetch(tbaUrl, {
        method: "GET",
        headers: {
            accept: "application/json",
            "X-TBA-Auth-Key": tba,
        },
    });
    return response.json();
}

/**
 * Fetches the team colors for a given number.
 *
 * @param {number} number - The team number.
 * @returns {Promise<Object>} - A promise that resolves to the team colors.
 */
async function fetchTeamColors(number) {
    const fetch = (await import("node-fetch")).default;
    const colorUrl = `${baseColorUrl}${number}`;
    const response = await fetch(colorUrl);
    return response.json();
}

/**
 * Creates roles for a team.
 * 
 * @param {Object} initialContext - The initial context object.
 * @param {Object} apiData - The data fetched from the API.
 * @returns {Object} - The roles object containing 
 *      the team role, 
 *      primary color role, 
 *      and secondary color role.
 */
async function createRoles(initialContext, apiData) {
    const { interaction, teamNumber } = initialContext;
    const { teamName, primaryColor, secondaryColor } = apiData;

    try {
        const teamRole = await interaction.guild.roles.create({
            name: `${teamNumber} | ${teamName}`,
        });

        const primaryColorRole = await interaction.guild.roles.create({
            name: `${teamNumber} | ${teamName} Primary`,
            color: betterColor(primaryColor),
        });

        const secondaryColorRole = await interaction.guild.roles.create({
            name: `${teamNumber} | ${teamName} Secondary`,
            color: betterColor(secondaryColor),
        });

        return { teamRole, primaryColorRole, secondaryColorRole };
    } catch (error) {
        console.error("Error creating roles:", error);
        throw error;
    }
}

/**
 * Creates a button message for team assignment.
 *
 * @param {number} teamNumber - The team number.
 * @param {Role}s roles - The roles to be assigned.
 * @returns {Object} - The button message object containing components and embeds.
 */
function createButtonMessage(teamNumber, roles) {
    const { teamRole, primaryColorRole, secondaryColorRole } = roles;

    const primaryButton = new ButtonBuilder()
        .setCustomId("primary")
        .setLabel("Primary")
        .setStyle(ButtonStyle.Success);

    const secondaryButton = new ButtonBuilder()
        .setCustomId("secondary")
        .setLabel("Secondary")
        .setStyle(ButtonStyle.Primary);

    const customButton = new ButtonBuilder()
        .setCustomId("custom")
        .setLabel("Custom")
        .setStyle(ButtonStyle.Secondary);

    const cancelButton = new ButtonBuilder()
        .setCustomId("cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(
        primaryButton,
        secondaryButton,
        customButton,
        cancelButton
    );

    const embed = createEmbed({
        title: "Team Assignment",
        description: `Welcome <@&${teamRole.id}>!\nYou are the first of your team to join FRCSD`,
        color: primaryColorRole.color,
        fields: [
            {
                name: "Select Color:",
                value: `<@&${primaryColorRole.id}>\n<@&${secondaryColorRole.id}>\nA Custom Hex?`,
                inline: false,
            },
        ],
        thumbnailUrl: `https://www.thebluealliance.com/avatar/2024/frc${teamNumber}.png`,
    });

    return {
        components: [row],
        embeds: [embed],
    };
}

/**
 * Sets the nickname of a member.
 * @param {GuildMember} member - The member whose nickname will be set.
 * @param {string} nickname - The new nickname to set.
 * @param {string} teamNumber - The team number to append to the nickname.
 * @returns {Promise<void>} - A promise that resolves when the nickname is set successfully.
 */
async function setNickname(member, nickname, teamNumber) {
    try {
        await member.setNickname(`${nickname} | ${teamNumber}`);
    } catch (error) {
        console.error(
            "Error setting nickname. Most likely a permissions issue"
        );
    }
}

/**
 * Handles the role assignment for a user.
 * 
 * @param {Object} initialContext - The initial context object.
 * @returns {Object} - The interaction reply and roles object.
 */
async function handleRoleAssignment(initialContext) {
    const { interaction, teamNumber } = initialContext;
    const teamData = await fetchTeamData(teamNumber);
    const teamColors = await fetchTeamColors(teamNumber);
    const apiData = {
        teamName: teamData.nickname,
        primaryColor: teamColors.primaryHex,
        secondaryColor: teamColors.secondaryHex
    };

    // we dont need to check secondary 
    // since if we have primary we have secondary
    if (apiData.teamName && apiData.primaryColor) {
        const roles = await createRoles(initialContext, apiData);
        const buttonMessage = createButtonMessage(teamNumber, roles);
        return {
            interactionReply: await interaction.reply(buttonMessage),
            roles,
        };
    } else {
        return {
            interactionReply: await interaction.reply(
                "Team data or colors not found."
            ),
        };
    }
}

/**
 * Adds an existing role to the member and sets their nickname.
 * @param {Interaction} interaction - The interaction object.
 * @param {Role} teamRole - The team role to be added.
 * @param {string} nickname - The nickname to be set.
 * @param {number} teamNumber - The team number.
 * @returns {Promise<Message>} - A promise that resolves to the reply message.
 * @throws {Error} - If there is an error adding the role.
 */
async function addExistingRole(interaction, teamRole, nickname, teamNumber) {
    try {
        await interaction.member.roles.add(teamRole.id);
        await setNickname(interaction.member, nickname, teamNumber);
        const members =
            interaction.guild.members.cache
                .filter(
                    (member) =>
                        member.roles.cache.has(teamRole.id) &&
                        member.id !== interaction.user.id
                )
                .map((member) => `<@${member.id}>`)
                .join("\n") || "You're the first one!";
        return await interaction.reply({
            embeds: [
                {
                    title: "Team Assignment",
                    description: `Added you to <@&${teamRole.id}>, <@${interaction.user.id}>`,
                    color: `${teamRole.color}`,
                    fields: [
                        {
                            name: "Others on your team in the server:",
                            value: members,
                        },
                    ],
                    thumbnail: {
                        url: `https://www.thebluealliance.com/avatar/2024/frc${teamNumber}.png`,
                    },
                },
            ],
        });
    } catch (error) {
        console.error("Error adding existing role:", error);
        return await interaction.reply(
            "There was an error adding you to the existing role."
        );
    }
}

/**
 * Handles the confirmation of a user interaction.
 *
 * @param {Object} initialContext - The initial context object, containing
 *      the interaction, teamNumber, and nickname.
 * @param {Message} interactionReply - The interaction reply message.
 * @param {Object} roles - The roles object, containing
 *      the team role, primary color role, and secondary color role.
 * @returns {Promise<void>} - A promise that resolves when the confirmation is handled.
 */
async function handleConfirmation(initialContext, interactionReply, roles) {
    const { interaction, teamNumber, nickname } = initialContext;
    
    const collectorFilter = (i) => i.user.id === interaction.user.id;

    try {
        const confirmation = await interactionReply.awaitMessageComponent({
            filter: collectorFilter,
            time: 120_000,
        });

        switch (confirmation.customId) {
            case "primary":
            case "secondary":
                await setRoleColor(initialContext, roles, confirmation, confirmation.customId);
                break;
            case "custom":
                await handleCustomColor(initialContext, roles, confirmation);
                break;
            case "cancel":
            default:
                await handleCancelOperation(initialContext, interactionReply, roles, confirmation);
                break;
        }
    } catch (e) {
        console.error('\n\n\n',e,'\n\n\n');

        for (const role of Object.values(roles)) {
            role.delete('An error occurred during setup')
                .catch(console.error);
        }

        const embed = createEmbed({
            title: "Something went wrong",
            description: `Perhaps a timeout?. Run /setup to try again`,
            color: 16711680,
            fields: [],
            thumbnailUrl: `https://www.thebluealliance.com/avatar/2024/frc${teamNumber}.png`,
        });

        await interaction
            .editReply({
                content: "",
                components: [],
                embeds: [embed],
            })
            .then(() => {
                setTimeout(() => {
                    interactionReply.delete();
                }, 10000);
            });
    }
}

/**
 * Sets the color of a role and updates the user's nickname.
 * 
 * @param {Object} initialContext - The initial context object, containing
 *      the interaction, teamNumber, and nickname.
 * @param {Object} roles - The roles object, containing
 *     the team role, primary color role, and secondary color role.
 * @param {Message} confirmation - The confirmation message.
 * @param {string} primaryOrSecondary - The color to set.
 */
async function setRoleColor(initialContext, roles, confirmation, primaryOrSecondary) {
    const { interaction, teamNumber, nickname } = initialContext;
    const member = interaction.member;
    const { teamRole, primaryColorRole, secondaryColorRole } = roles;

    const desiredColor =
        primaryOrSecondary === "primary"
            ? primaryColorRole.color
            : secondaryColorRole.color;
    await teamRole.setColor(desiredColor);
    
    await primaryColorRole.delete();
    await secondaryColorRole.delete();

    await member.roles.add(teamRole);
    await setNickname(member, nickname, teamNumber);

    const embed = createEmbed({
        title: "Team Assignment",
        description: `Added you to <@&${teamRole.id}>, <@${interaction.user.id}>`,
        color: desiredColor,
        fields: [],
        thumbnailUrl: `https://www.thebluealliance.com/avatar/2024/frc${teamNumber}.png`,
    });

    await confirmation.update({ content: ``, components: [], embeds: [embed] });
}

/**
 * Handles the custom color selection for a user.
 * 
 * @param {Object} initialContext - The initial context object, containing
 *     the interaction, teamNumber, and nickname.
 * @param {Object} roles - The roles object, containing
 *    the team role, primary color role, and secondary color role.
 * @param {Message} confirmation - The confirmation message.
 */
async function handleCustomColor(initialContext, roles, confirmation) {
    const { interaction, teamNumber, nickname } = initialContext;
    const { teamRole, primaryColorRole, secondaryColorRole } = roles;

    await primaryColorRole.delete();
    await secondaryColorRole.delete();

    const embed = createEmbed({
        title: "Custom Color",
        description: `Please enter a hex code for the color you\nwould like to use for <@&${teamRole.id}>`,
        color: teamRole.color,
        fields: [
            {
                // Werid thing to note:
                // The code crashes if the name field is empty
                name: "Formatting:",
                value: "Accepted formats are **#RRGGBB**, **RRGGBB**, **#RGB**, and **RGB**",
                inline: false,
            },
        ],
        thumbnailUrl: `https://www.thebluealliance.com/avatar/2024/frc${teamNumber}.png`,
    });

    await confirmation.update({ content: " ", components: [], embeds: [embed] });

    let tryCount = 1;
    let customHex;
    const messageList = [];

    while (true) {
        const customColor = await confirmation.channel.awaitMessages({
            filter: ((m) => m.author.id === interaction.user.id),
            max: 1,
            time: 120_000,
        });
        const message = customColor.first().content;
        const hexRegex = /#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/;
        const hexMatch = message.match(hexRegex);

        if (hexMatch) {
            customHex = hexMatch[1] || hexMatch[0];
            if (customHex.length === 3) {
                customHex = customHex
                    .split("")
                    .map((char) => char + char)
                    .join("");
            }
            customHex = customHex.padEnd(6, customHex);

            const customHexInt = parseInt(customHex, 16);

            const embed = createEmbed({
                title: "Custom Color",
                description: `Please enter a hex code for the color you\nwould like to use for <@&${teamRole.id}>`,
                color: customHexInt,
                fields: [
                    {
                        name: "Role Assignment",
                        value: `Added you to <@&${teamRole.id}>, <@${interaction.user.id}>`,
                        inline: false,
                    },
                ],
                thumbnailUrl: `https://www.thebluealliance.com/avatar/2024/frc${teamNumber}.png`,
            });

            await interaction.editReply({
                content: "",
                components: [],
                embeds: [embed],
            });
            await customColor.first().delete();
            for (const msg of messageList) {
                await msg.delete();
            }
            break;
        } else {
            const embed = createEmbed({
                title: "Custom Color",
                description: `Please enter a hex code for the color you\nwould like to use for <@&${teamRole.id}>`,
                color: teamRole.color,
                fields: [
                    {
                        name: `**Invalid hex code, please try again (${tryCount})**`,
                        value: "Accepted formats are **#RRGGBB**, **RRGGBB**, **#RGB**, and **RGB**",
                        inline: false,
                    },
                ],
                thumbnailUrl: `https://www.thebluealliance.com/avatar/2024/frc${teamNumber}.png`,
            });

            await interaction.editReply({
                content: "",
                components: [],
                embeds: [embed],
            });
            tryCount++;
            messageList.push(customColor.first());
        }
    }
    await teamRole.setColor(`#${customHex}`);
    await interaction.member.roles.add(teamRole);
    await setNickname(interaction.member, nickname, teamNumber);
}

/**
 * Handles the cancellation of a user operation.
 * 
 * @param {Object} initialContext - The initial context object, containing
 *    the interaction, teamNumber, and nickname.
 * @param {Object} roles - The roles object, containing
 *    the team role, primary color role, and secondary color role.
 * @param {Message} confirmation - The confirmation message.
 */
async function handleCancelOperation(initialContext, interactionReply, roles, confirmation) {
    roles.teamRole.delete();
    roles.primaryColorRole.delete();
    roles.secondaryColorRole.delete();
    const embed = createEmbed({
        title: "Operation Cancelled",
        description: "Run /setup to try again",
        color: 16711680,
        thumbnailUrl: `https://www.thebluealliance.com/avatar/2024/frc${initialContext.teamNumber}.png`,
    });

    await confirmation
        .update({ content: "", components: [], embeds: [embed] })
        .then(() => {
            setTimeout(() => {
                interactionReply.delete();
            }, 10000);
        });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Setup command to get you started!")
        .addStringOption((option) =>
            option
                .setName("nickname")
                .setDescription("Your name")
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("teamnumber")
                .setDescription("The team number")
                .setRequired(true)
        ),
    async execute(interaction) {
        // Check if this user already has an interaction with this command happening
        
        const teamNumber = interaction.options.getInteger("teamnumber");
        const nickname = interaction.options.getString("nickname");
        const alreadyARole = interaction.guild.roles.cache.find((role) =>
            role.name.startsWith(`${teamNumber} |`)
        );

        if (alreadyARole) {
            await addExistingRole(
                interaction,
                alreadyARole,
                nickname,
                teamNumber
            );
            // .then((result) => {
            // 	// Wait five seconds and delete the original message
            // 	setTimeout(() => {
            // 		result.delete();
            // 	}, 10000);
            // });
            return;
        }

        // Define the initial context object
        const initialContext = {
            interaction,
            teamNumber,
            nickname,
        };

        // Handle role assignment and update the roles context object
        const {interactionReply, roles} = await handleRoleAssignment(initialContext);

        // Pass the context objects to handleConfirmation
        await handleConfirmation(initialContext, interactionReply, roles);
        // .then(() => {
        // 	setTimeout(() => {
        // 		initialResponse.delete();
        // 	}, 10000);
        // });
    },
};
