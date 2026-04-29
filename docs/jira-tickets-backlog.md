# Lista de Jiras — Price Monitor Nestlé-ORT-G2

## Resumen

- Total de issues relevados: **45**.
- Tipos: **19 épicas** y **26 tareas**.
- Estados: **14 Done**, **2 In Progress**, **29 To Do**.
- El CSV no incluye los issues **PM-29 a PM-38**; no se agregaron issues inexistentes.

## Épicas iniciales del proyecto

### PM-1 — Definir alcance final del MVP

**Descripción ampliada**

Define el alcance funcional final del MVP de Price Monitor Nestlé, dejando claro qué funcionalidades entran en la primera versión y cuáles quedan fuera. Sirve como base para ordenar el backlog, priorizar sprints y evitar desvíos de alcance durante la implementación.

**Entregable / criterio de cierre sugerido**

Documento o acuerdo de alcance validado, con funcionalidades incluidas, exclusiones, supuestos y criterio de aceptación general del MVP.

### PM-2 — Implementar frontend MVP

**Descripción ampliada**

Agrupa la implementación del frontend MVP. Incluye las pantallas necesarias para que el usuario pueda operar el sistema desde una interfaz web: visualizar productos, URLs monitoreadas, precios, capturas, alertas y reportes básicos.

**Entregable / criterio de cierre sugerido**

Frontend navegable construido con React, Vite y Tailwind CSS, integrado con la API del backend.

### PM-3 — QA, testing y demo del sistema

**Descripción ampliada**

Agrupa las actividades de validación del sistema, testing funcional y preparación de la demo. Su foco es demostrar que el flujo principal funciona de punta a punta con datos representativos.

**Entregable / criterio de cierre sugerido**

Flujo end-to-end probado y demo preparada con datos semilla realistas.

### PM-4 — Despliegue y cierre del proyecto

**Descripción ampliada**

Agrupa las tareas de despliegue, documentación y cierre del proyecto. Busca dejar el sistema ejecutable, documentado y listo para su presentación o instalación en un entorno controlado.

**Entregable / criterio de cierre sugerido**

Deploy preparado, documentación actualizada y entregables finales cerrados.

## Épicas temáticas

### PM-41 — Fundación técnica e infraestructura

**Descripción ampliada**

Épica temática orientada a la base técnica del sistema: estructura del proyecto, arquitectura, modelo de datos y backend inicial. Funciona como paraguas conceptual para la fundación del producto.

**Entregable / criterio de cierre sugerido**

Base técnica estable que permita desarrollar las funcionalidades principales sin rehacer arquitectura.

### PM-42 — Autenticación y seguridad

**Descripción ampliada**

Épica temática de autenticación, autorización y seguridad de acceso. Cubre login, JWT, protección de endpoints, roles mínimos y restricciones operativas.

**Entregable / criterio de cierre sugerido**

Sistema con acceso protegido y comportamiento seguro frente a solicitudes no autorizadas.

### PM-43 — Gestión de productos y retailers
 
**Descripción ampliada**

Épica temática para administrar el catálogo de monitoreo: productos, retailers y URLs. Es la base funcional sobre la cual trabaja el motor de scraping.

**Entregable / criterio de cierre sugerido**

Catálogo administrable desde backend y/o frontend.

### PM-44 — Motor de scraping y evidencia
 
**Descripción ampliada**

Épica temática del motor de scraping y evidencia. Incluye extracción de precios, detección de promociones, ejecución de scraping y preservación de evidencia auditable.

**Entregable / criterio de cierre sugerido**

Motor capaz de capturar precios y guardar evidencia verificable.

### PM-45 — Automatización de monitoreo
 
**Descripción ampliada**

Épica temática de automatización. Cubre scheduler, jobs, ejecución periódica y logs operativos para que el monitoreo corra sin intervención manual.

**Entregable / criterio de cierre sugerido**

Monitoreo automático, trazable y recurrente.

### PM-46 — Reglas, alertas y notificaciones
 
**Descripción ampliada**

Épica temática de reglas, alertas y notificaciones. Convierte las capturas en eventos accionables cuando se detectan desvíos o condiciones relevantes.

**Entregable / criterio de cierre sugerido**

Motor de reglas integrado con alertas y notificaciones.

### PM-47 — Reportes y exportaciones
 
**Descripción ampliada**

Épica temática de reportes y exportaciones. Permite convertir los datos del monitoreo en archivos o vistas útiles para análisis, control y presentación.

**Entregable / criterio de cierre sugerido**

Reportes exportables y consultas útiles para seguimiento del negocio.

## Épicas por sprint

### PM-48 — Sprint 0 — Fundación e Infraestructura
 
**Descripción ampliada**

Sprint inicial de fundación e infraestructura. Prepara el entorno de trabajo, arquitectura, base de datos y backend base para comenzar el desarrollo funcional.

**Entregable / criterio de cierre sugerido**

Proyecto listo para desarrollo colaborativo con backend y modelo inicial operativos.

### PM-49 — Sprint 1 — Autenticación y Usuarios
 
**Descripción ampliada**

Sprint dedicado a autenticación y usuarios. Asegura que el sistema tenga acceso controlado antes de exponer funcionalidades sensibles o administrativas.

**Entregable / criterio de cierre sugerido**

Login, JWT y protección de endpoints implementados.

### PM-50 — Sprint 2 — CRUD Productos y Retailers

**Descripción ampliada**

Sprint dedicado al CRUD de productos y retailers. Deja preparado el catálogo que alimentará el monitoreo de precios.

**Entregable / criterio de cierre sugerido**

Productos, retailers y URLs administrables.

### PM-51 — Sprint 3 — Motor de Scraping

**Descripción ampliada**

Sprint central del motor de scraping. Implementa la navegación, extracción de precios, detección de promociones, endpoint manual y evidencia.

**Entregable / criterio de cierre sugerido**

Motor de scraping funcional y verificable.

### PM-52 — Sprint 4 — Scheduler y Jobs

**Descripción ampliada**

Sprint de scheduler y jobs. Automatiza la ejecución periódica del monitoreo y agrega trazabilidad mediante logs de ejecución.

**Entregable / criterio de cierre sugerido**

Jobs recurrentes ejecutando monitoreos y registrando resultados.

### PM-53 — Sprint 5 — Motor de Reglas y Alertas

**Descripción ampliada**

Sprint de motor de reglas y alertas. Evalúa capturas contra reglas de negocio y genera alertas/notificaciones cuando se detectan desvíos.

**Entregable / criterio de cierre sugerido**

Reglas, alertas y notificaciones integradas al flujo de monitoreo.

### PM-54 — Sprint 6 — Frontend MVP

**Descripción ampliada**

Sprint de frontend MVP. Construye las pantallas necesarias para operar el sistema desde el navegador: dashboard, gestión, resultados y alertas.

**Entregable / criterio de cierre sugerido**

Frontend MVP navegable e integrado con backend.

### PM-55 — Sprint 7 — Reportes, Demo y Cierre

**Descripción ampliada**

Sprint de reportes, demo y cierre. Consolida testing, exportaciones, seed de demo, deploy y documentación final.

**Entregable / criterio de cierre sugerido**

Sistema validado, desplegable, documentado y listo para presentación.

## Tareas

### PM-48 — Sprint 0 — Fundación e Infraestructura

#### PM-5 — Configurar entorno de trabajo

**Descripción ampliada**

Configura el repositorio y la estructura inicial del proyecto, separando backend y frontend. Incluye variables de entorno, estructura de carpetas y base mínima para que el equipo pueda trabajar de forma ordenada.

**Entregable / criterio de cierre sugerido**

Repositorio funcional con estructura backend/frontend, dependencias instaladas y comandos básicos documentados.

#### PM-6 — Definir arquitectura del sistema

**Descripción ampliada**

Define la arquitectura técnica del sistema, incluyendo los componentes principales: backend NestJS, frontend React, base de datos PostgreSQL/Prisma, scraping con Playwright/Cheerio y módulos de automatización.

**Entregable / criterio de cierre sugerido**

Diagrama o documento de arquitectura con responsabilidades, stack tecnológico y comunicación entre módulos.

#### PM-7 — Diseñar modelo de datos (Schema Prisma)

**Descripción ampliada**

Diseña el modelo de datos inicial del sistema mediante Prisma. Debe cubrir usuarios, productos, retailers, URLs monitoreadas, capturas de precio, reglas, alertas y logs necesarios para auditoría.

**Entregable / criterio de cierre sugerido**

Schema Prisma consistente, migraciones iniciales y relaciones principales definidas.

#### PM-8 — Implementar base del backend (NestJS + Prisma)

**Descripción ampliada**

Implementa la base del backend en NestJS con Prisma, configuración global, conexión a base de datos, módulos principales y estructura preparada para los servicios posteriores.

**Entregable / criterio de cierre sugerido**

Servidor NestJS levantando correctamente, conectado a PostgreSQL y con estructura modular base.

### PM-49 — Sprint 1 — Autenticación y Usuarios

#### PM-9 — Autenticación JWT y gestión de usuarios

**Descripción ampliada**

Implementa autenticación JWT y gestión básica de usuarios. Debe permitir login seguro, protección de endpoints y separación de roles o permisos mínimos necesarios para operar el sistema.

**Entregable / criterio de cierre sugerido**

Endpoints protegidos, emisión/validación de token JWT y flujo de autenticación funcional.

### PM-50 — Sprint 2 — CRUD Productos y Retailers

#### PM-10 — CRUD de productos y retailers

**Descripción ampliada**

Implementa el CRUD de productos y retailers, permitiendo administrar los elementos que luego serán monitoreados por el motor de scraping.

**Entregable / criterio de cierre sugerido**

Alta, edición, listado, consulta y baja lógica/física de productos, retailers y URLs asociadas según el diseño del modelo.

### PM-51 — Sprint 3 — Motor de Scraping

#### PM-11 — Implementar scraping MVP (Playwright + Cheerio)

**Descripción ampliada**

Implementa el scraping MVP usando Playwright y Cheerio. El objetivo es poder acceder a una URL de e-commerce, obtener el HTML renderizado y extraer información base del producto monitoreado.

**Entregable / criterio de cierre sugerido**

Scraper funcional para una URL objetivo, con manejo básico de errores y respuesta estructurada.

#### PM-12 — PriceExtractor — estrategias de extracción

**Descripción ampliada**

Construye el PriceExtractor con estrategias de extracción robustas para detectar precios en sitios con estructuras diferentes. Debe priorizar fuentes confiables como JSON-LD, metatags, microdata y selectores CSS de fallback.

**Entregable / criterio de cierre sugerido**

Extractor con estrategias encadenadas, parseo de precios en formatos locales/internacionales y datos de depuración sobre la estrategia utilizada.

#### PM-13 — PromoDetector — detección de promociones

**Descripción ampliada**

Implementa el PromoDetector para identificar promociones o descuentos visibles en la página monitoreada. Debe detectar señales como textos promocionales, porcentajes, precios anteriores o condiciones comerciales relevantes.

**Entregable / criterio de cierre sugerido**

Detector de promociones integrado al scraping, con salida normalizada para indicar si hay promoción y qué evidencia textual la respalda.

#### PM-14 — ScrapingService — flujo principal y evidencia

**Descripción ampliada**

Implementa el ScrapingService como flujo principal del motor de monitoreo. Coordina navegación, extracción de precio, detección de promociones, persistencia de resultados y guardado de evidencia HTML/capturas.

**Entregable / criterio de cierre sugerido**

Servicio central de scraping con persistencia de capturas, evidencia auditable y manejo controlado de errores.

#### PM-15 — Endpoint de scraping manual (development)

**Descripción ampliada**

Expone un endpoint de scraping manual para desarrollo y pruebas. Permite ejecutar una captura puntual desde la API sin esperar al scheduler automático.

**Entregable / criterio de cierre sugerido**

Endpoint disponible para disparar scraping manual, probar URLs y validar la respuesta del motor en ambiente de desarrollo.

### PM-52 — Sprint 4 — Scheduler y Jobs

#### PM-16 — Sistema de automatización de monitoreo (scheduler + jobs + ejecución)

**Descripción ampliada**

Implementa la automatización del monitoreo mediante scheduler, jobs y ejecución programada. Debe permitir que las URLs activas se procesen automáticamente sin intervención manual.

**Entregable / criterio de cierre sugerido**

Jobs programados, cola o scheduler operativo y mecanismo para ejecutar monitoreos periódicos.

#### PM-17 — Registrar logs de ejecución (JobLog)

**Descripción ampliada**

Registra logs de ejecución de cada job para trazabilidad operativa. Debe guardar inicio, fin, duración, estado y errores asociados a cada proceso de monitoreo.

**Entregable / criterio de cierre sugerido**

Entidad JobLog persistida y consultable, con datos suficientes para diagnosticar fallas o demoras.

### PM-53 — Sprint 5 — Motor de Reglas y Alertas

#### PM-18 — Implementar motor de reglas de desvío

**Descripción ampliada**

Implementa el motor de reglas de desvío para comparar precios capturados contra condiciones esperadas. Permite detectar diferencias relevantes, promociones no autorizadas o incumplimientos de política comercial.

**Entregable / criterio de cierre sugerido**

Motor parametrizable que evalúa capturas y devuelve resultados de regla con severidad y motivo.

#### PM-19 — AlertsService — creación, deduplicación y gestión

**Descripción ampliada**

Implementa AlertsService para crear, deduplicar y gestionar alertas generadas por el motor de reglas. Evita duplicados innecesarios y mantiene el estado de seguimiento de cada alerta.

**Entregable / criterio de cierre sugerido**

Alertas persistidas con severidad, estado, relación a producto/captura y lógica de deduplicación.

#### PM-20 — Integración rules → alerts → notificaciones (Email)

**Descripción ampliada**

Integra el flujo rules → alerts → notificaciones por email. Después de cada scraping, las capturas se evalúan, se generan alertas cuando corresponde y se notifica a los usuarios configurados.

**Entregable / criterio de cierre sugerido**

Pipeline integrado con envío de email para alertas relevantes y registro del resultado de notificación.

### PM-54 — Sprint 6 — Frontend MVP

#### PM-22 — Crear estructura base frontend (React + Vite + Tailwind)

**Descripción ampliada**

Crea la estructura base del frontend con React, Vite, TypeScript y Tailwind. Incluye routing, layout inicial, configuración visual y base para consumir la API.

**Entregable / criterio de cierre sugerido**

Frontend levantando localmente, con estructura de rutas y estilos base preparados.

#### PM-23 — Dashboard y visualización de precios actuales

**Descripción ampliada**

Implementa el dashboard para visualizar precios actuales y métricas principales. Debe mostrar estado del monitoreo, retailers, productos relevantes y alertas activas.

**Entregable / criterio de cierre sugerido**

Dashboard funcional con tarjetas/resúmenes y datos provenientes del backend.

#### PM-24 — Gestión de productos y URLs en UI

**Descripción ampliada**

Implementa la gestión de productos y URLs desde la interfaz. Permite crear, editar, activar/desactivar y consultar los elementos monitoreados sin operar directamente la base o la API.

**Entregable / criterio de cierre sugerido**

Pantallas y formularios para administrar productos, retailers y URLs monitoreadas.

#### PM-25 — Visualizar resultados de monitoreo en tiempo real

**Descripción ampliada**

Permite visualizar resultados de monitoreo en tiempo real o casi real. Muestra capturas recientes con precio, fecha, promoción detectada, estado y posible evidencia asociada.

**Entregable / criterio de cierre sugerido**

Vista de resultados/capturas con filtros básicos y datos claros para seguimiento operativo.

#### PM-26 — Visualizar alertas en frontend

**Descripción ampliada**

Implementa la visualización de alertas en el frontend. Debe mostrar severidad, estado, producto, retailer, fecha y permitir revisar o filtrar alertas relevantes.

**Entregable / criterio de cierre sugerido**

Pantalla de alertas integrada al backend, con filtros y lectura clara del estado de cada caso.

### PM-55 — Sprint 7 — Reportes, Demo y Cierre

#### PM-21 — Exportar reportes (Excel / CSV)

**Descripción ampliada**

Implementa exportación de reportes en Excel o CSV para análisis externo. Debe permitir descargar resultados filtrados por producto, fecha o período de monitoreo.

**Entregable / criterio de cierre sugerido**

Endpoint o acción de exportación que genere archivos con precios, alertas y datos relevantes del monitoreo.

#### PM-27 — Testing end-to-end y validación de flujo completo

**Descripción ampliada**

Valida el flujo completo del sistema de punta a punta: login, creación de producto, carga de URL, ejecución de scraping, generación de captura, evaluación de reglas, alerta y visualización en frontend.

**Entregable / criterio de cierre sugerido**

Evidencia de testing end-to-end y checklist del flujo principal aprobado.

#### PM-28 — Preparar demo y seed de datos realistas

**Descripción ampliada**

Prepara una demo con datos realistas para presentar el sistema. Incluye usuarios, productos Nestlé, retailers, URLs de monitoreo, capturas y alertas de ejemplo.

**Entregable / criterio de cierre sugerido**

Seed de datos y guion de demo listos para mostrar el valor del MVP.

#### PM-39 — Preparar deploy del sistema (Docker + CI/CD)

**Descripción ampliada**

Prepara el despliegue del sistema usando Docker y CI/CD. El objetivo es que backend, frontend y servicios dependientes puedan levantarse de forma reproducible.

**Entregable / criterio de cierre sugerido**

docker-compose o configuración equivalente funcionando, con instrucciones de deploy y variables documentadas.

#### PM-40 — Documentación y cierre del proyecto

**Descripción ampliada**

Cierra la documentación del proyecto, incluyendo README, instrucciones de instalación, ejecución, uso, arquitectura y consideraciones técnicas relevantes.

**Entregable / criterio de cierre sugerido**

Documentación final actualizada y entregables listos para evaluación o transferencia.
