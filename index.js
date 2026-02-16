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

const fs = require("fs");

// ===== CONFIG SISTEMA CUENTAS =====
const ID_CANAL_CUENTAS = "https://discord.com/channels/1465579629002752175/1465586004739231764";
const ID_ROL_STAFF = "1465580669668429856";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ticketsAbiertos = new Map();

client.once("ready", async () => {
  console.log(`Bot listo como ${client.user.tag}`);

  const canalPanel = await client.channels.fetch("1465585688018813009").catch(() => null);
  if (!canalPanel) return console.log("No se encontró el canal del panel.");

  const embed = new EmbedBuilder()
    .setTitle("🎫 Tickets")
    .setDescription("Bienvenidos a la sección de tickets! Podés crear uno abajo.")
    .setColor("Red");

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_menu")
      .setPlaceholder("Selecciona una categoría")
      .addOptions([
        { label: "Soporte", value: "soporte", description: "Problemas técnicos" },
        { label: "Compras", value: "compras", description: "Pagos y productos" },
        { label: "Reportes", value: "reportes", description: "Reportar usuarios" }
      ])
  );

  await canalPanel.send({ embeds: [embed], components: [menu] });
});


// ================= INTERACCIONES =================
client.on(Events.InteractionCreate, async interaction => {

  // CREAR TICKET
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_menu") {

    await interaction.deferReply({ ephemeral: true });

    if (ticketsAbiertos.has(interaction.user.id)) {
      return interaction.editReply({ content: "❌ Ya tenés un ticket abierto." });
    }

    const tipo = interaction.values[0];
    const prioridad = tipo === "reportes" ? "Alta" : "Normal";

    const canal = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: "1473033607923765370",
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: "1465580669668429856", allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ],
    });

    ticketsAbiertos.set(interaction.user.id, canal.id);

    const embedTicket = new EmbedBuilder()
      .setTitle("🎟 Nuevo Ticket")
      .addFields(
        { name: "Usuario", value: interaction.user.tag },
        { name: "Tipo", value: tipo },
        { name: "Prioridad", value: prioridad }
      )
      .setColor("Green")
      .setTimestamp();

    const botonCerrar = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cerrar_ticket")
        .setLabel("Cerrar Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await canal.send({
      content: `<@${interaction.user.id}> <@&1465580669668429856>`,
      embeds: [embedTicket],
      components: [botonCerrar]
    });

    await canal.send("🤖 Mensaje automático:\nExplicá tu problema con el mayor detalle posible.");

    await interaction.editReply({ content: "✅ Ticket creado!" });
  }

  // CERRAR TICKET
  if (interaction.isButton() && interaction.customId === "cerrar_ticket") {

    await interaction.deferReply({ ephemeral: true });

    const mensajes = await interaction.channel.messages.fetch({ limit: 100 });

    const transcript = mensajes
      .map(m => `${m.author.tag}: ${m.content}`)
      .reverse()
      .join("\n");

    const canalLogs = await interaction.guild.channels.fetch("1473033392118304960").catch(() => null);

    if (canalLogs) {
      const embedLog = new EmbedBuilder()
        .setTitle("📁 Ticket Cerrado")
        .setDescription(`Canal: ${interaction.channel.name}`)
        .setColor("Black")
        .setTimestamp();

      await canalLogs.send({
        embeds: [embedLog],
        files: [{
          attachment: Buffer.from(transcript, "utf-8"),
          name: "transcript.txt"
        }]
      });
    }

    ticketsAbiertos.delete(interaction.user.id);
    await interaction.channel.delete();
  }

});


// ================= RESPUESTAS AUTOMÁTICAS =================
client.on("messageCreate", async message => {

  if (message.author.bot) return;
  if (!message.channel.name.startsWith("ticket-")) return;

  const contenido = message.content.toLowerCase();

  if (contenido.includes("hola")) {
    return message.reply("👋 Hola! En breve un staff te atenderá.");
  }

  if (contenido.includes("precio")) {
    return message.reply("💰 Podés consultar los precios en el canal de información.");
  }

  if (contenido.includes("error")) {
    return message.reply("⚠️ Si tenés un error, enviá una captura de pantalla.");
  }

});

// ================= SISTEMA DE CUENTAS =================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (!message.content.startsWith("!cuenta")) return;

  // Verificar rol staff
  if (!message.member.roles.cache.has(ID_ROL_STAFF)) {
    return message.reply("❌ No tenés permiso para usar este comando.");
  }

  const args = message.content.split(" ").slice(1);

  if (args.length < 4) {
    return message.reply("Uso:\n!cuenta correo contraseña juegos imagenURL");
  }

  const correo = args[0];
  const contraseña = args[1];
  const imagen = args[args.length - 1];
  const juegos = args.slice(2, args.length - 1).join(" ");

  // Leer contador
  const data = JSON.parse(fs.readFileSync("./contador.json"));
  data.numero += 1;
  fs.writeFileSync("./contador.json", JSON.stringify(data, null, 2));

  const numeroFormateado = String(data.numero).padStart(3, "0");

  const canal = await client.channels.fetch(ID_CANAL_CUENTAS).catch(() => null);

  if (!canal) {
    return message.reply("❌ No se encontró el canal de cuentas.");
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎮 Cuenta #${numeroFormateado}`)
    .addFields(
      { name: "📧 Correo", value: correo },
      { name: "🔐 Contraseña", value: `||${contraseña}||` },
      { name: "🕹 Juegos", value: juegos }
    )
    .setImage(imagen)
    .setColor("Blue")
    .setTimestamp();

  await canal.send({ embeds: [embed] });

  // Borra mensaje original
  await message.delete().catch(() => null);

  message.channel.send(`✅ Cuenta #${numeroFormateado} enviada.`)
    .then(msg => setTimeout(() => msg.delete().catch(() => null), 3000));
});


client.login(process.env.TOKEN);