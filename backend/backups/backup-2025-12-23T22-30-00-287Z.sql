--
-- PostgreSQL database dump
--

\restrict Afqhc6PEWpkGVSf7ITBRKvrEAS3yX1TjxbnRsSLqynlr0MWTdabovQXQrxHVZN2

-- Dumped from database version 14.19 (Homebrew)
-- Dumped by pg_dump version 14.19 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: PaymentFrequency; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public."PaymentFrequency" AS ENUM (
    'MONTHLY',
    'YEARLY',
    'ONE_TIME'
);


ALTER TYPE public."PaymentFrequency" OWNER TO admin;

--
-- Name: RequestStatus; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public."RequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'ACTIVE',
    'EXPIRED',
    'CANCELLED'
);


ALTER TYPE public."RequestStatus" OWNER TO admin;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'MANAGER',
    'ACCOUNTANT'
);


ALTER TYPE public."Role" OWNER TO admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO admin;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    "actionType" text NOT NULL,
    "targetId" text,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "actorId" integer NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO admin;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO admin;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name text NOT NULL,
    "monthlyBudget" numeric(65,30) NOT NULL,
    "currentManagerId" integer
);


ALTER TABLE public.departments OWNER TO admin;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.departments_id_seq OWNER TO admin;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: manager_departments; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.manager_departments (
    id integer NOT NULL,
    "managerId" integer NOT NULL,
    "departmentId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.manager_departments OWNER TO admin;

--
-- Name: manager_departments_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.manager_departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.manager_departments_id_seq OWNER TO admin;

--
-- Name: manager_departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.manager_departments_id_seq OWNED BY public.manager_departments.id;


--
-- Name: request_comments; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.request_comments (
    id integer NOT NULL,
    content text NOT NULL,
    "requestId" integer NOT NULL,
    "userId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.request_comments OWNER TO admin;

--
-- Name: request_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.request_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.request_comments_id_seq OWNER TO admin;

--
-- Name: request_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.request_comments_id_seq OWNED BY public.request_comments.id;


--
-- Name: requests; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.requests (
    id integer NOT NULL,
    status public."RequestStatus" DEFAULT 'PENDING'::public."RequestStatus" NOT NULL,
    "platformName" text NOT NULL,
    "planType" text,
    url text,
    cost numeric(65,30) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "startDate" timestamp(3) without time zone,
    "renewalDate" timestamp(3) without time zone,
    "credentialVault" text,
    "rejectionReason" text,
    "attachmentUrl" text,
    "paymentFrequency" public."PaymentFrequency" DEFAULT 'MONTHLY'::public."PaymentFrequency" NOT NULL,
    "departmentId" integer NOT NULL,
    "requesterId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "exchangeRate" numeric(65,30),
    "localCost" numeric(65,30),
    "paymentCardId" text,
    "deletedAt" timestamp(3) without time zone
);


ALTER TABLE public.requests OWNER TO admin;

--
-- Name: requests_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.requests_id_seq OWNER TO admin;

--
-- Name: requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.requests_id_seq OWNED BY public.requests.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."Role" NOT NULL,
    "telegramChatId" text,
    "telegramAuthToken" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO admin;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO admin;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: manager_departments id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.manager_departments ALTER COLUMN id SET DEFAULT nextval('public.manager_departments_id_seq'::regclass);


--
-- Name: request_comments id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.request_comments ALTER COLUMN id SET DEFAULT nextval('public.request_comments_id_seq'::regclass);


--
-- Name: requests id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.requests ALTER COLUMN id SET DEFAULT nextval('public.requests_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
1f817aec-4bc1-4a27-96b4-63b77b2e0e7c	a1ab613468eb971c40bb88b59a4f4c530dd9c5488729eabfff3323fe4fc9ecd2	2025-12-16 16:33:57.150018+03:30	20251216105821_init	\N	\N	2025-12-16 16:33:57.101209+03:30	1
d5f89b9d-4720-4e9e-8065-ab2f49897e10	d9b2086412510f7edfc85a8584c07a90bdb1fbd1341fee89b8f471942db3c1ca	2025-12-16 16:33:57.166395+03:30	20251216110635_add_comments	\N	\N	2025-12-16 16:33:57.150951+03:30	1
dc330c13-5a26-4188-b8e2-1d1ec49e55c8	1c61a954abf3f56ed72bd221e942b362ae220a020f17f6058da06573d6c44394	2025-12-16 16:33:57.173384+03:30	20251216115108_add_payment_tracking_fields	\N	\N	2025-12-16 16:33:57.167388+03:30	1
89ea111f-3092-4f53-8db4-abfad742c144	c99401c3652ea2a7b52a9693ec27fcba82dca5a752e21c69e689b99a80ebc5cb	2025-12-16 18:00:29.465274+03:30	20251216180000_add_manager_department_relation	\N	\N	2025-12-16 18:00:29.436384+03:30	1
560268f1-e6b6-4e0a-83dd-279a03cf0bfd	43b3e2d2929c87fe59d1c7e8974251f9631d366c46a4329956e5c527f725c8c1	\N	20251218000000_add_deleted_at_to_requests	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20251218000000_add_deleted_at_to_requests\n\nDatabase error code: 42701\n\nDatabase error:\nERROR: column "deletedAt" of relation "requests" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42701), message: "column \\"deletedAt\\" of relation \\"requests\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(7086), routine: Some("check_for_column_name_collision") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20251218000000_add_deleted_at_to_requests"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20251218000000_add_deleted_at_to_requests"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	2025-12-20 12:51:59.335575+03:30	2025-12-20 12:51:47.124998+03:30	0
d693cd17-c489-4d64-af0e-c4623f6fc80e	43b3e2d2929c87fe59d1c7e8974251f9631d366c46a4329956e5c527f725c8c1	2025-12-20 12:51:59.337178+03:30	20251218000000_add_deleted_at_to_requests		\N	2025-12-20 12:51:59.337178+03:30	0
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.audit_logs (id, "actionType", "targetId", "timestamp", "actorId") FROM stdin;
1	DEPARTMENT_CREATED	3	2025-12-16 14:19:38.273	2
2	USER_UPDATED	4	2025-12-16 14:34:41.9	2
3	REQUEST_DELETED	5	2025-12-17 11:49:51.226	1
4	REQUEST_DELETED	14	2025-12-17 11:50:07.871	1
5	REQUEST_DELETED	13	2025-12-17 12:07:29.578	1
6	REQUEST_DELETED	12	2025-12-17 12:07:29.578	1
7	REQUEST_DELETED	11	2025-12-17 12:07:29.578	1
8	REQUEST_DELETED	10	2025-12-17 12:07:29.578	1
9	REQUEST_DELETED	9	2025-12-17 12:07:29.578	1
10	REQUEST_DELETED	8	2025-12-17 12:07:29.578	1
11	REQUEST_DELETED	7	2025-12-17 12:07:29.578	1
12	REQUEST_DELETED	4	2025-12-17 12:07:29.578	1
13	REQUEST_DELETED	29	2025-12-17 12:10:19.008	1
14	REQUEST_DELETED	28	2025-12-17 12:10:19.008	1
15	REQUEST_DELETED	27	2025-12-17 12:10:19.008	1
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.departments (id, name, "monthlyBudget", "currentManagerId") FROM stdin;
1	IT Department	5000.000000000000000000000000000000	4
2	Marketing	2000.000000000000000000000000000000	4
3	AI	300.000000000000000000000000000000	1
\.


--
-- Data for Name: manager_departments; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.manager_departments (id, "managerId", "departmentId", "createdAt") FROM stdin;
1	4	1	2025-12-16 18:00:29.442
2	4	2	2025-12-16 18:00:29.442
3	1	3	2025-12-16 18:00:29.442
\.


--
-- Data for Name: request_comments; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.request_comments (id, content, "requestId", "userId", "createdAt") FROM stdin;
1	email:ali@gmail.com	1	1	2025-12-16 14:35:35.768
2	password:ali7879	1	1	2025-12-16 14:35:47.321
3	no\n	6	1	2025-12-16 15:45:22.144
4	why u delete that!\n	6	1	2025-12-16 15:45:33.677
5	thanks\n	27	1	2025-12-17 08:55:28.734
6	thanks\n	27	1	2025-12-17 08:55:29.611
7	thanks	27	1	2025-12-17 08:55:39.363
8	why	26	1	2025-12-17 08:55:48.268
9	user pass\n	28	1	2025-12-17 08:57:14.745
10	uuu	28	3	2025-12-17 09:01:11.765
11	user pass\n	29	1	2025-12-17 09:26:31.94
12	okay	29	3	2025-12-17 11:48:11.327
13	مدارک\n	31	3	2025-12-20 11:01:41.334
14	رمزش کو؟	32	3	2025-12-20 12:36:49.65
15	اااا رمزشو ندادم ۰۳۳۹۴۲۵۲۴۵	32	1	2025-12-20 12:37:20.754
\.


--
-- Data for Name: requests; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.requests (id, status, "platformName", "planType", url, cost, currency, "startDate", "renewalDate", "credentialVault", "rejectionReason", "attachmentUrl", "paymentFrequency", "departmentId", "requesterId", "createdAt", "updatedAt", "exchangeRate", "localCost", "paymentCardId", "deletedAt") FROM stdin;
26	APPROVED	alizx	pro	\N	20.000000000000000000000000000000	USD	\N	\N	\N	\N	\N	MONTHLY	3	1	2025-12-17 08:46:49.794	2025-12-17 12:48:37.311	\N	\N	\N	\N
2	REJECTED	gemini	pro	\N	20.000000000000000000000000000000	USD	\N	\N	\N	you cant buy gemini account	\N	MONTHLY	3	1	2025-12-16 14:49:34.852	2025-12-16 14:51:42.667	\N	\N	\N	\N
3	REJECTED	gemini	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	reject	\N	MONTHLY	3	1	2025-12-16 14:52:16.998	2025-12-16 15:30:50.149	\N	\N	\N	\N
6	REJECTED	gemini	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	forgot to tell you	\N	MONTHLY	3	1	2025-12-16 15:43:24.603	2025-12-16 15:44:20.549	\N	\N	\N	\N
25	APPROVED	gemini33	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	\N	\N	MONTHLY	3	1	2025-12-17 08:41:57.645	2025-12-17 12:49:25.398	\N	\N	\N	\N
24	APPROVED	gemini33	pro	\N	90.000000000000000000000000000000	USD	\N	\N	\N	\N	\N	MONTHLY	3	1	2025-12-17 08:41:56.586	2025-12-17 12:50:05.543	\N	\N	\N	\N
16	REJECTED	gemini33	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	0	\N	MONTHLY	3	1	2025-12-17 08:41:29.456	2025-12-17 12:08:07.732	\N	\N	\N	\N
5	PENDING	gemini	333	\N	30.000000000000000000000000000000	USD	\N	\N	\N	\N	\N	MONTHLY	3	1	2025-12-16 15:40:26.136	2025-12-17 11:49:51.223	\N	\N	\N	2025-12-17 11:49:51.222
23	APPROVED	gemini33	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	\N	\N	MONTHLY	3	1	2025-12-17 08:41:49.776	2025-12-17 12:50:21.434	\N	\N	\N	\N
22	APPROVED	gemini33	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	\N	\N	MONTHLY	3	1	2025-12-17 08:41:49.593	2025-12-17 12:50:27.615	\N	\N	\N	\N
21	APPROVED	gemini33	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	\N	\N	MONTHLY	3	1	2025-12-17 08:41:49.428	2025-12-17 12:50:33.476	\N	\N	\N	\N
14	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765960877306-97971781.png	MONTHLY	3	1	2025-12-17 08:41:17.334	2025-12-17 11:50:07.869	\N	\N	\N	2025-12-17 11:50:07.868
4	PENDING	gemini	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	\N	\N	MONTHLY	3	1	2025-12-16 15:31:08.083	2025-12-17 12:07:29.571	\N	\N	\N	2025-12-17 12:07:29.57
15	REJECTED	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	0	/uploads/screenshot-1765960877308-85722087.png	MONTHLY	3	1	2025-12-17 08:41:17.335	2025-12-17 11:35:32.863	\N	\N	\N	\N
7	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765960861992-645125221.png	MONTHLY	3	1	2025-12-17 08:41:02.001	2025-12-17 12:07:29.571	\N	\N	\N	2025-12-17 12:07:29.57
8	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765960864794-736138716.png	MONTHLY	3	1	2025-12-17 08:41:04.799	2025-12-17 12:07:29.571	\N	\N	\N	2025-12-17 12:07:29.57
20	REJECTED	gemini33	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	0	\N	MONTHLY	3	1	2025-12-17 08:41:48.831	2025-12-17 12:09:16.604	\N	\N	\N	\N
19	REJECTED	gemini33	pro	\N	20.000000000000000000000000000000	USD	\N	\N	\N	0	\N	MONTHLY	3	1	2025-12-17 08:41:37.397	2025-12-17 12:09:23.355	\N	\N	\N	\N
17	REJECTED	gemini33	pro	\N	300.000000000000000000000000000000	USD	\N	\N	\N	0	\N	MONTHLY	3	1	2025-12-17 08:41:31.937	2025-12-17 12:09:28.301	\N	\N	\N	\N
18	REJECTED	gemini33	pro	\N	300.000000000000000000000000000000	USD	\N	\N	\N	0	\N	MONTHLY	3	1	2025-12-17 08:41:32.955	2025-12-17 12:09:35.175	\N	\N	\N	\N
1	REJECTED	gpt	pro	\N	32.000000000000000000000000000000	USD	\N	\N	\N	0	\N	MONTHLY	3	1	2025-12-16 14:33:44.637	2025-12-17 12:09:40.958	\N	\N	32322321	\N
29	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	30.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765963573715-621122312.png	MONTHLY	3	1	2025-12-17 09:26:13.723	2025-12-17 12:10:19.006	\N	\N	\N	2025-12-17 12:10:19.005
28	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	30.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765961806533-101251998.png	MONTHLY	3	1	2025-12-17 08:56:46.543	2025-12-17 12:10:19.006	\N	\N	\N	2025-12-17 12:10:19.005
27	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	67.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765961314454-762505244.png	MONTHLY	3	1	2025-12-17 08:48:34.46	2025-12-17 12:10:19.006	\N	\N	\N	2025-12-17 12:10:19.005
9	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765960867172-632234302.png	MONTHLY	3	1	2025-12-17 08:41:07.177	2025-12-17 12:07:29.571	\N	\N	\N	2025-12-17 12:07:29.57
10	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765960869871-975869285.png	MONTHLY	3	1	2025-12-17 08:41:09.876	2025-12-17 12:07:29.571	\N	\N	\N	2025-12-17 12:07:29.57
11	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765960871393-200640371.png	MONTHLY	3	1	2025-12-17 08:41:11.399	2025-12-17 12:07:29.571	\N	\N	\N	2025-12-17 12:07:29.57
12	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765960872927-967627554.png	MONTHLY	3	1	2025-12-17 08:41:12.934	2025-12-17 12:07:29.571	\N	\N	\N	2025-12-17 12:07:29.57
13	PENDING	gemini	pro	https://img.freepik.com/free-vector/illustration-robot-vector-graphic_53876-17639.jpg?t=st=1729345955~exp=1729349555~hmac=63fedc28bc1c4a9bbdcaa1f99db47410048db98b9afb2ff148c76d33509f53d2&w=1800	300.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1765960877311-255407727.png	MONTHLY	3	1	2025-12-17 08:41:17.32	2025-12-17 12:07:29.571	\N	\N	\N	2025-12-17 12:07:29.57
30	PENDING	gemini	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	\N	\N	MONTHLY	3	1	2025-12-20 11:00:42.878	2025-12-20 11:00:42.878	\N	\N	\N	\N
32	APPROVED	gemini	pro	\N	30.000000000000000000000000000000	USD	\N	\N	\N	\N	/uploads/screenshot-1766234176966-895876862.png	MONTHLY	3	1	2025-12-20 12:36:17.003	2025-12-20 12:38:07.25	\N	\N	\N	\N
31	REJECTED	gemini	pro	\N	30.000000000000000000000000000000	USD	\N	\N	U2FsdGVkX19bZgREjrsOBhklno9e2fwjwjpFjrTf3+zUOVq8BNwf+joYwlzZMPZlhlFFcHFea0WSeahyOnTmsw==	پنکپنم	\N	MONTHLY	3	1	2025-12-20 11:00:43.553	2025-12-20 12:39:31.037	\N	\N	\N	\N
33	PENDING	gemini	pro	\N	30.000000000000000000000000000000	USD	\N	\N	U2FsdGVkX1+tKdVxo+m9TnmLz0eue/ipSyRnNHLEWVZIUPUutK5Z9wHjgSTtdWkdPLqMuEQR1BgDSWCxrUPmjkn2I98JvdIIAtondmYgNfs=	\N	\N	MONTHLY	3	1	2025-12-23 08:53:45.043	2025-12-23 08:53:45.043	\N	\N	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.users (id, name, email, "passwordHash", role, "telegramChatId", "telegramAuthToken", "createdAt", "updatedAt") FROM stdin;
2	Admin User	admin@corp.com	$2b$10$QlFhwCHQ.W0CktHgE2ThmujujHXn.zRRYQRdRDRlc2yAQeHK4JFUq	ADMIN	\N	\N	2025-12-16 13:07:02.424	2025-12-16 13:07:02.424
4	Manager User	manager@corp.com	$2b$10$np5iRqTpvggYzWxbrlCC9OcBFU7GJCFgguuoDoegSZVkrla8Mn85i	MANAGER	\N	\N	2025-12-16 13:07:02.435	2025-12-16 14:34:41.897
1	ali	aliyazarloo78@gmail.com	$2b$10$M0td5.volNA366SD2fccDeNJ5g4mqbb2V.AR1wlnHPSNr/d2G1JhC	MANAGER	7385460476	\N	2025-12-16 13:05:41.507	2025-12-17 09:00:50.963
3	Accountant User	accountant@corp.com	$2b$10$QlFhwCHQ.W0CktHgE2ThmujujHXn.zRRYQRdRDRlc2yAQeHK4JFUq	ACCOUNTANT	604431212	\N	2025-12-16 13:07:02.431	2025-12-17 09:26:57.598
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 15, true);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.departments_id_seq', 3, true);


--
-- Name: manager_departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.manager_departments_id_seq', 6, true);


--
-- Name: request_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.request_comments_id_seq', 15, true);


--
-- Name: requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.requests_id_seq', 33, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: manager_departments manager_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.manager_departments
    ADD CONSTRAINT manager_departments_pkey PRIMARY KEY (id);


--
-- Name: request_comments request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT request_comments_pkey PRIMARY KEY (id);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: manager_departments_managerId_departmentId_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "manager_departments_managerId_departmentId_key" ON public.manager_departments USING btree ("managerId", "departmentId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_telegramChatId_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE UNIQUE INDEX "users_telegramChatId_key" ON public.users USING btree ("telegramChatId");


--
-- Name: audit_logs audit_logs_actorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: departments departments_currentManagerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "departments_currentManagerId_fkey" FOREIGN KEY ("currentManagerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: manager_departments manager_departments_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.manager_departments
    ADD CONSTRAINT "manager_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: manager_departments manager_departments_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.manager_departments
    ADD CONSTRAINT "manager_departments_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: request_comments request_comments_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT "request_comments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public.requests(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: request_comments request_comments_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.request_comments
    ADD CONSTRAINT "request_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: requests requests_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT "requests_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: requests requests_requesterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT "requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: lee
--

GRANT ALL ON SCHEMA public TO admin;


--
-- PostgreSQL database dump complete
--

\unrestrict Afqhc6PEWpkGVSf7ITBRKvrEAS3yX1TjxbnRsSLqynlr0MWTdabovQXQrxHVZN2

