# Turnos de recepción

Generador automático de cuadrantes semanales con normas activables.

## Arrancar

1. `npm install`
2. `npm run dev` y abre http://localhost:3000

- **Panel del administrador:** dirección principal. Sin contraseña por ahora. Cuando quieras, pon un PIN en Ajustes → Seguridad para que los empleados no puedan entrar al panel.
- **Empleados:** `http://TU-DIRECCION/?portal=empleado`. Ven su cuadrante y piden días. Nunca ven roles ni ajustes.

## Cómo funciona

- El conserje de noche trabaja sus 5 noches. Sus días libres los cubre cada semana una recepcionista distinta de la rotación de noches.
- Al salir de noche, cada empleado tiene su opción: tarde al día siguiente o 2 días libres.
- Cada semana libra sábado y domingo una persona distinta.
- Todos trabajan 5 días y libran 2 seguidos.
- Por la tarde nunca hay dos ayudantes juntos y siempre hay un recepcionista.
- Personal por día, horarios, roles, empleados y cada norma se cambian en **Ajustes**.
- Las normas son por empleado: en Ajustes → Equipo, cada persona tiene «Normas de esta persona» (jornada y días trabajados, libres seguidos, descanso, vacaciones como libres, reparto de tardes y salida de noche). Lo que no se cambie sigue la pestaña «Normas generales».
- Turno especial automático: los días con 4 o más de mañana, una de esas personas hace 10:00–18:00 (por turnos). Se ajusta en Ajustes → Normas generales; cada empleado puede quedar fuera desactivando «Especial» en su ficha.
- También se puede pedir un turno especial extra por día en Ajustes → Personal por día.
- Plus de nocturnidad: cuenta las horas trabajadas entre las 22:00 y las 06:00 (tarde = 2 h, noche = 6 h) y marca quién llega a 26 h al mes. Aparece en la columna «Nocturnidad», en el PDF y en el portal de cada empleado. Se ajusta en Ajustes → Normas generales.
- **Preferencia de mañanas y tardes:** cada empleado entra en su portal → pestaña «Mis preferencias» y elige cuántas mañanas y cuántas tardes prefiere a la semana (o «Me da igual»). Es una preferencia suave: el cuadrante intenta cumplirla, pero la cobertura y el resto de normas mandan. Si una semana no cabe, el panel lo avisa debajo del estado de las normas. El administrador también puede verla y cambiarla en Ajustes → Equipo. Se guarda en `data/preferences.json`.
- Si cambias una casilla a mano, el resto del cuadrante se reorganiza solo.
- Encima del cuadrante aparece si cumple todas las normas o qué falla exactamente.

## Archivos principales

- `scheduleService.ts`: motor de generación y validación.
- `components/SetupForm.tsx`: ajustes.
- `components/EmployeePortal.tsx`: portal del empleado.
- `server.ts`: guarda los datos en `data/` y protege la configuración con el PIN.
