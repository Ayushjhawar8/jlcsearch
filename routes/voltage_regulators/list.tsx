import { Table } from "lib/ui/Table"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { formatPrice } from "lib/util/format-price"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    package: z.string().optional(),
    output_type: z.enum(["fixed", "adjustable", ""]).optional(),
    is_ldo: z.boolean().optional(),
    output_voltage: z.coerce.number().optional(),
  }),
  jsonResponse: z.any(),
} as const)(async (req, ctx) => {
  // Start with base query
  let query = ctx.db
    .selectFrom("voltage_regulator")
    .selectAll()
    .limit(100)
    .orderBy("stock", "desc")

  // Apply package filter
  if (req.query.package) {
    query = query.where("package", "=", req.query.package)
  }

  // Apply output type filter
  if (req.query.output_type) {
    query = query.where("output_type", "=", req.query.output_type)
  }

  // Apply LDO filter
  if (req.query.is_ldo !== undefined) {
    query = query.where("is_low_dropout", "=", req.query.is_ldo ? 1 : 0)
  }

  // Apply output voltage filter
  if (req.query.output_voltage) {
    query = query.where((eb) =>
      eb.or([
        eb("output_voltage_min", "<=", req.query.output_voltage!),
        eb("output_voltage_max", ">=", req.query.output_voltage!),
      ]),
    )
  }

  // Get unique packages for dropdown
  const packages = await ctx.db
    .selectFrom("voltage_regulator")
    .select("package")
    .distinct()
    .orderBy("package")
    .execute()

  const regulators = await query.execute()

  if (ctx.isApiRequest) {
    return ctx.json({
      regulators: regulators.map((r) => ({
        lcsc: r.lcsc,
        mfr: r.mfr,
        package: r.package,
        output_type: r.output_type,
        is_low_dropout: r.is_low_dropout === 1,
        is_positive: r.is_positive === 1,
        output_voltage_min: r.output_voltage_min,
        output_voltage_max: r.output_voltage_max,
        output_current_max: r.output_current_max,
        dropout_voltage: r.dropout_voltage,
        input_voltage_min: r.input_voltage_min,
        input_voltage_max: r.input_voltage_max,
        quiescent_current: r.quiescent_current,
        stock: r.stock,
        price1: r.price1,
      })),
    })
  }

  return ctx.react(
    <div>
      <h2>Voltage Regulators</h2>

      <form method="GET" className="flex flex-row gap-4">
        <div>
          <label>Package:</label>
          <select name="package">
            <option value="">All</option>
            {packages.map((p) => (
              <option
                key={p.package}
                value={p.package ?? ""}
                selected={p.package === req.query.package}
              >
                {p.package}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Output Type:</label>
          <select name="output_type">
            <option value="">All</option>
            <option value="fixed" selected={req.query.output_type === "fixed"}>
              Fixed
            </option>
            <option
              value="adjustable"
              selected={req.query.output_type === "adjustable"}
            >
              Adjustable
            </option>
          </select>
        </div>

        <div>
          <label>LDO:</label>
          <select name="is_ldo">
            <option value="">All</option>
            <option value="true" selected={req.query.is_ldo === true}>
              Yes
            </option>
            <option value="false" selected={req.query.is_ldo === false}>
              No
            </option>
          </select>
        </div>

        <div>
          <label>Output Voltage:</label>
          <input
            type="number"
            name="output_voltage"
            step="0.1"
            placeholder="V"
            defaultValue={req.query.output_voltage}
          />
        </div>

        <button type="submit">Filter</button>
      </form>

      <Table
        rows={regulators.map((r) => ({
          lcsc: r.lcsc,
          mfr: r.mfr,
          package: r.package,
          type: [
            r.output_type === "fixed" ? "Fixed" : "Adjustable",
            r.is_low_dropout ? "LDO" : null,
            r.is_positive ? "Positive" : "Negative",
          ]
            .filter(Boolean)
            .join(", "),
          output:
            r.output_voltage_min === r.output_voltage_max ? (
              <span className="tabular-nums">{r.output_voltage_min}V</span>
            ) : (
              <span className="tabular-nums">
                {r.output_voltage_min}V - {r.output_voltage_max}V
              </span>
            ),
          current: r.output_current_max ? (
            <span className="tabular-nums">{r.output_current_max}A</span>
          ) : (
            ""
          ),
          dropout: r.dropout_voltage ? (
            <span className="tabular-nums">{r.dropout_voltage}V</span>
          ) : (
            ""
          ),
          input:
            r.input_voltage_min && r.input_voltage_max ? (
              <span className="tabular-nums">
                {r.input_voltage_min}V - {r.input_voltage_max}V
              </span>
            ) : (
              ""
            ),
          quiescent: r.quiescent_current ? (
            <span className="tabular-nums">{r.quiescent_current}A</span>
          ) : (
            ""
          ),
          stock: <span className="tabular-nums">{r.stock}</span>,
          price: <span className="tabular-nums">{formatPrice(r.price1)}</span>,
        }))}
      />
    </div>,
    "JLCPCB Voltage Regulator Search",
  )
})
