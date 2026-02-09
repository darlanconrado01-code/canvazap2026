
export default async function handler(req: any, res: any) {
    return res.status(200).json({
        success: true,
        message: "Hello from API",
        method: req.method,
        body: req.body
    });
}
