const express = require("express");
const app = express();
const fs = require("fs");

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  Events
} = require("discord.js");

const { joinVoiceChannel } = require("@discordjs/voice");

/* ================== CONFIG ================== */

const PORT = process.env.PORT;
const TOKEN = process.env.TOKEN;

const ID_CANAL_CUENTAS = "1465586004739231764";
const ID_ROL_STAFF = "1465580669668429856";
const ID_CANAL_VERIFICACION = "1465579629774508035";
const ID_ROL_MIEMBRO = "1465581457857581067";
const ID_PANEL_TICKETS = "1465585688018813009";
const ID_CATEGORIA_TICKETS = "1473033607923765370";
const ID_LOGS = "1473033392118304960";
const ID_CANAL_VOZ = "1465579629774508036";

/* ================== EXPRESS ================== */

app.get("/", (req, res) => res.send("Bot activo"));
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Servidor web activo en puerto ${PORT}`)
);

/* ================== CLIENT ================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const ticketsAbiertos = new Map();
const cooldownRespuestas = new Map();

/* ================== READY ================== */

client.once("ready", async () => {
  console.log(`Bot listo como ${client.user.tag}`);

  const guild = client.guilds.cache.first();

  // Conectar a canal de voz
  const canalVoz = guild.channels.cache.get(ID_CANAL_VOZ);
  if (canalVoz) {
    joinVoiceChannel({
      channelId: canalVoz.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator
    });
    console.log("Conectado al canal de voz");
  }

  // Mensaje verificación
  const canalVerificacion = await client.channels.fetch(ID_CANAL_VERIFICACION).catch(() => null);
  if (canalVerificacion) {
    const embed = new EmbedBuilder()
      .setTitle("Games Place ⭐")
      .setDescription("Presiona el botón para verificarte.")
      .setColor("Red");

    const boton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("verificar")
        .setLabel("✅ Verificar")
        .setStyle(ButtonStyle.Success)
    );

    await canalVerificacion.send({ embeds: [embed], components: [boton] });
  }

  // Panel tickets
  const canalPanel = await client.channels.fetch(ID_PANEL_TICKETS).catch(() => null);
  if (canalPanel) {
    const embed = new EmbedBuilder()
      .setTitle("🎫 Tickets")
      .setDescription("Selecciona una categoría.")
      .setColor("Red");

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ticket_menu")
        .setPlaceholder("Selecciona una categoría")
        .addOptions([
          { label: "Soporte", value: "soporte" },
          { label: "Compras", value: "compras" },
          { label: "Reportes", value: "reportes" }
        ])
    );

    await canalPanel.send({ embeds: [embed], components: [menu] });
  }
});

/* ================== INTERACCIONES ================== */

client.on(Events.InteractionCreate, async interaction => {

  /* ===== VERIFICACIÓN ===== */
  if (interaction.isButton() && interaction.customId === "verificar") {
    if (interaction.member.roles.cache.has(ID_ROL_MIEMBRO))
      return interaction.reply({ content: "⚠️ Ya estás verificado.", ephemeral: true });

    await interaction.member.roles.add(ID_ROL_MIEMBRO);
    return interaction.reply({ content: "✅ Verificado correctamente.", ephemeral: true });
  }

  /* ===== CREAR TICKET ===== */
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {

    await interaction.deferReply({ ephemeral: true });

    if (ticketsAbiertos.has(interaction.user.id))
      return interaction.editReply({ content: "❌ Ya tenes un ticket abierto." });

    const tipo = interaction.values[0];
    const prioridad = tipo === "reportes" ? "Alta" : "Normal";

    const canal = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: ID_CATEGORIA_TICKETS,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: ID_ROL_STAFF, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    ticketsAbiertos.set(interaction.user.id, canal.id);

    const embed = new EmbedBuilder()
      .setTitle("🎟 Nuevo Ticket")
      .addFields(
        { name: "Usuario", value: interaction.user.tag },
        { name: "Tipo", value: tipo },
        { name: "Prioridad", value: prioridad }
      )
      .setColor("Green");

    const botonCerrar = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cerrar_ticket")
        .setLabel("Cerrar Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await canal.send({
      content: `<@${interaction.user.id}> <@&${ID_ROL_STAFF}>`,
      embeds: [embed],
      components: [botonCerrar]
    });

    await interaction.editReply({ content: "✅ Ticket creado!" });
  }

  /* ===== CERRAR TICKET ===== */
  if (interaction.isButton() && interaction.customId === "cerrar_ticket") {

    if (!interaction.member.roles.cache.has(ID_ROL_STAFF))
      return interaction.reply({ content: "❌ Solo el staff puede cerrar.", ephemeral: true });

    const canal = interaction.channel;
    const mensajes = await canal.messages.fetch({ limit: 100 });

    const transcript = mensajes.map(m => `${m.author.tag}: ${m.content}`).reverse().join("\n");

    const canalLogs = await interaction.guild.channels.fetch(ID_LOGS).catch(() => null);

    if (canalLogs) {
      await canalLogs.send({
        embeds: [new EmbedBuilder()
          .setTitle("📁 Ticket Cerrado")
          .setDescription(`Canal: ${canal.name}\nCerrado por: ${interaction.user.tag}`)
          .setColor("Red")],
        files: [{ attachment: Buffer.from(transcript), name: "transcript.txt" }]
      });
    }

    await interaction.reply({ content: "✅ Ticket cerrado.", ephemeral: true });
    setTimeout(() => canal.delete().catch(() => null), 2000);
  }

});

/* ================== MENSAJES ================== */

client.on("messageCreate", async message => {

  if (message.author.bot) return;

  /* ===== RESPUESTAS AUTOMÁTICAS EN TICKETS ===== */
  if (message.channel.name.startsWith("ticket-")) {

    if (cooldownRespuestas.has(message.channel.id)) return;

    const contenido = message.content.toLowerCase();

    const respuestas = {
      saludo: ["hola", "buenas", "hey"],
      precios: ["precio", "cuanto", "valor"],
      errores: ["error", "bug", "problema"]
    };

    for (const tipo in respuestas) {
      if (respuestas[tipo].some(p => contenido.includes(p))) {

        const embed = new EmbedBuilder()
          .setTitle("🤖 Respuesta automática")
          .setDescription("Un staff te atenderá pronto.")
          .setColor("Blue");

        await message.reply({ embeds: [embed] });

        cooldownRespuestas.set(message.channel.id, true);
        setTimeout(() => cooldownRespuestas.delete(message.channel.id), 10000);
        break;
      }
    }
  }

  /* ===== COMANDO !cuenta ===== */
  if (message.content.startsWith("!cuenta")) {

    if (!message.member.roles.cache.has(ID_ROL_STAFF))
      return message.reply("❌ No tenés permiso.");

    const args = message.content.split(" ").slice(1);
    if (args.length < 4)
      return message.reply("Uso: !cuenta correo contraseña juegos imagenURL");

    const correo = args[0];
    const contraseña = args[1];
    const imagen = args[args.length - 1];
    const juegos = args.slice(2, args.length - 1).join(" ");

    const data = JSON.parse(fs.readFileSync("./contador.json"));
    data.numero += 1;
    fs.writeFileSync("./contador.json", JSON.stringify(data, null, 2));

    const numero = String(data.numero).padStart(3, "0");
    const canal = await client.channels.fetch(ID_CANAL_CUENTAS);

    const embed = new EmbedBuilder()
      .setTitle(`🎮 Cuenta #${numero}`)
      .addFields(
        { name: "📧 Correo", value: correo },
        { name: "🔐 Contraseña", value: `||${contraseña}||` },
        { name: "🕹 Juegos", value: juegos }
      )
      .setImage(imagen)
      .setColor("Blue");

    await canal.send({ embeds: [embed] });
    await message.delete().catch(() => null);
  }

  /* ===== COMANDOS $ ===== */
  if (message.channel.name.startsWith("ticket-") && message.content.startsWith("$")) {

    if (!message.member.roles.cache.has(ID_ROL_STAFF))
      return message.reply("❌ Solo el staff puede usar esto.");

    const comando = message.content.toLowerCase();

    if (comando === "$transcript") {
      const mensajes = await message.channel.messages.fetch({ limit: 100 });
      const transcript = mensajes.map(m => `${m.author.tag}: ${m.content}`).reverse().join("\n");

      await message.channel.send({
        files: [{ attachment: Buffer.from(transcript), name: "transcript.txt" }]
      });

      await message.delete().catch(() => null);
    }

    if (comando === "$delete") {
      await message.reply("🔒 Cerrando ticket...");
      setTimeout(() => message.channel.delete().catch(() => null), 2000);
    }
  }

});

client.login(TOKEN);