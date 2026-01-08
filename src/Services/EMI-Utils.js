export const getEmiDetails = (course) => {
 

  // Check if EMI is available for this course
  // Handle both boolean and string values for isAvailable
  const isEmiAvailable =
    course?.emi?.isAvailable === true ||
    course?.emi?.isAvailable === "true" ||
    course?.emi?.isAvailable === "True";

  if (!isEmiAvailable) {
        return {
      eligible: false,
      months: 0,
      monthlyAmount: 0,
      totalAmount: 0,
      reason: "EMI not available for this course",
    };
  }

  const emiConfig = course.emi;

  // Convert string values to numbers if needed
  const months =
    typeof emiConfig.emiDurationMonths === "string"
      ? parseInt(emiConfig.emiDurationMonths)
      : emiConfig.emiDurationMonths;

  const monthlyAmount =
    typeof emiConfig.monthlyAmount === "string"
      ? parseFloat(emiConfig.monthlyAmount)
      : emiConfig.monthlyAmount;

  const totalAmount =
    typeof emiConfig.totalAmount === "string"
      ? parseFloat(emiConfig.totalAmount)
      : emiConfig.totalAmount;

  const result = {
    eligible: true,
    months: months,
    monthlyAmount: monthlyAmount,
    totalAmount: totalAmount,
    notes: emiConfig.notes || null,
  };

    return result;
};

export const validateCourseForEmi = (course) => {
  
  // Check if course has EMI configuration
  if (!course?.emi) {
        throw new Error("EMI configuration not found for this course");
  }

  const emiDetails = getEmiDetails(course);
  
  if (!emiDetails.eligible) {
        throw new Error(emiDetails.reason || "EMI not available for this course");
  }

  // Validate that EMI total amount matches course final price
  if (course.price.finalPrice !== emiDetails.totalAmount) {
        throw new Error(
      `EMI total amount ₹${emiDetails.totalAmount} does not match course price ₹${course.price.finalPrice}`
    );
  }

    return emiDetails;
};

// Calculate EMI payment status and due amounts
export const calculateEmiStatus = (emiPlan) => {
  
  const today = new Date();
  const emis = emiPlan.emis || [];

  // Categorize EMIs
  const paidEmis = emis.filter((emi) => emi.status === "paid");
  const pendingEmis = emis.filter((emi) => emi.status === "pending");
  const lateEmis = emis.filter((emi) => emi.status === "late");
  const overdueEmis = emis.filter(
    (emi) =>
      (emi.status === "pending" || emi.status === "late") &&
      emi.gracePeriodEnd < today
  );
  const upcomingEmis = emis.filter(
    (emi) => emi.status === "pending" && emi.dueDate > today
  );
  const gracePeriodEmis = emis.filter(
    (emi) =>
      emi.status === "pending" &&
      emi.dueDate <= today &&
      emi.gracePeriodEnd >= today
  );

  // Calculate amounts
  const totalPaid = paidEmis.reduce((sum, emi) => sum + emi.amount, 0);
  const totalOverdue = overdueEmis.reduce((sum, emi) => sum + emi.amount, 0);
  const totalRemaining = emis
    .filter((emi) => emi.status !== "paid")
    .reduce((sum, emi) => sum + emi.amount, 0);
  const nextDueAmount =
    [...gracePeriodEmis, ...overdueEmis, ...upcomingEmis].sort(
      (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
    )[0]?.amount || 0;

  // Determine access status
  const hasOverduePayments = overdueEmis.length > 0;
  const isCurrentOnPayments = hasOverduePayments === false;
  const hasAccessToContent = isCurrentOnPayments && emiPlan.status === "active";

  const result = {
    // EMI counts
    totalEmis: emis.length,
    paidCount: paidEmis.length,
    pendingCount: pendingEmis.length,
    lateCount: lateEmis.length,
    overdueCount: overdueEmis.length,
    upcomingCount: upcomingEmis.length,
    gracePeriodCount: gracePeriodEmis.length,

    // Amount calculations
    totalAmount: emiPlan.totalAmount,
    totalPaid,
    totalOverdue,
    totalRemaining,
    nextDueAmount,

    // Status information
    planStatus: emiPlan.status,
    hasOverduePayments,
    isCurrentOnPayments,
    hasAccessToContent,

    // Next payment info
    nextDueDate:
      [...gracePeriodEmis, ...overdueEmis, ...upcomingEmis].sort(
        (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
      )[0]?.dueDate || null,

    // EMI arrays for detailed info
    overdueEmis,
    gracePeriodEmis,
    upcomingEmis,
    paidEmis,
  };

  
  return result;
};

// Calculate which EMIs need to be paid and validate payment amount
export const calculatePaymentAllocation = (emiPlan, paymentAmount) => {
  
  const today = new Date();
  const emis = emiPlan.emis || [];

  // Get unpaid EMIs in order of priority: overdue first, then due, then upcoming
  const overdueEmis = emis
    .filter(
      (emi) =>
        (emi.status === "pending" || emi.status === "late") &&
        emi.gracePeriodEnd < today
    )
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const gracePeriodEmis = emis
    .filter(
      (emi) =>
        emi.status === "pending" &&
        emi.dueDate <= today &&
        emi.gracePeriodEnd >= today
    )
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const upcomingEmis = emis
    .filter((emi) => emi.status === "pending" && emi.dueDate > today)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // Combine in priority order
  const unpaidEmisInOrder = [
    ...overdueEmis,
    ...gracePeriodEmis,
    ...upcomingEmis,
  ];

  let remainingAmount = paymentAmount;
  const emisToPay = [];
  const partialPayment = null; // Currently not supporting partial EMI payments

  for (const emi of unpaidEmisInOrder) {
    if (remainingAmount >= emi.amount) {
      emisToPay.push({
        emiId: emi._id,
        month: emi.month,
        monthName: emi.monthName,
        amount: emi.amount,
        dueDate: emi.dueDate,
        isOverdue: emi.gracePeriodEnd < today,
        isInGracePeriod: emi.dueDate <= today && emi.gracePeriodEnd >= today,
      });
      remainingAmount -= emi.amount;
    } else {
      break; // Cannot afford this EMI, stop allocation
    }
  }

  const result = {
    isValidAmount: remainingAmount === 0, // Must pay exact EMI amounts
    totalAllocated: paymentAmount - remainingAmount,
    remainingAmount,
    emisToPay,
    suggestedAmount: unpaidEmisInOrder
      .slice(0, emisToPay.length + 1)
      .reduce((sum, emi) => sum + emi.amount, 0),
    nextEmiAmount: unpaidEmisInOrder[emisToPay.length]?.amount || 0,
    canPayPartial: false, // Currently disabled
  };

  
  return result;
};

// Update EMI plan after successful payment
export const updateEmiAfterPayment = async (
  emiPlan,
  paymentAllocation,
  paymentDetails
) => {
  
  const EMIPlan = (await import("../Models/Emi-Plan/Emi-Plan-Model.js"))
    .default;

  const updateOperations = [];
  const paymentDate = new Date();

  for (const emiToPay of paymentAllocation.emisToPay) {
    updateOperations.push({
      updateOne: {
        filter: {
          _id: emiPlan._id,
          "emis._id": emiToPay.emiId,
        },
        update: {
          $set: {
            "emis.$.status": "paid",
            "emis.$.paymentDate": paymentDate,
            "emis.$.razorpayOrderId": paymentDetails.razorpayOrderId,
            "emis.$.razorpayPaymentId": paymentDetails.razorpayPaymentId,
            "emis.$.razorpaySignature": paymentDetails.razorpaySignature,
          },
        },
      },
    });
  }

  // Execute all EMI updates
  if (updateOperations.length > 0) {
    await EMIPlan.bulkWrite(updateOperations);
  }

  // Check if plan should be unlocked or completed
  const updatedPlan = await EMIPlan.findById(emiPlan._id);
  const emiStatus = calculateEmiStatus(updatedPlan);

  let planUpdates = {};

  // If no more overdue payments and plan was locked, unlock it
  if (!emiStatus.hasOverduePayments && updatedPlan.status === "locked") {
    planUpdates.status = "active";
    planUpdates["$push"] = {
      lockHistory: {
        lockDate: new Date(),
        unlockDate: new Date(),
        overdueMonths: 0,
        reasonForLock: "Auto-unlocked after payment",
        lockedBy: "system",
      },
    };
  }

  // If all EMIs are paid, mark as completed
  if (emiStatus.pendingCount === 0 && emiStatus.lateCount === 0) {
    planUpdates.status = "completed";
  }

  if (Object.keys(planUpdates).length > 0) {
    await EMIPlan.findByIdAndUpdate(emiPlan._id, planUpdates);
  }

  
  return {
    updatedEmis: paymentAllocation.emisToPay.length,
    newPlanStatus: planUpdates.status || updatedPlan.status,
    emiStatus,
  };
};

// Create comprehensive payment record for EMI payments
export const createEmiPaymentRecord = async (
  paymentData,
  emiPlan,
  paymentAllocation,
  paymentDetails
) => {
  
  const Payment = (await import("../Models/Payment-Model/Payment-Model.js"))
    .default;

  const payment = new Payment({
    // Basic payment info
    userId: paymentData.userId,
    courseId: paymentData.courseId,
    username: emiPlan.username,
    studentRegisterNumber: emiPlan.studentRegisterNumber,
    email: emiPlan.email,
    mobile: emiPlan.mobile || "N/A",
    CourseMotherId: emiPlan.CourseMotherId,
    courseName: emiPlan.coursename,

    // Payment details
    amount: paymentData.amount,
    currency: "INR",
    transactionId: paymentData.transactionId,
    paymentMethod: paymentData.paymentMethod || "CARD",
    paymentStatus: "completed",
    paymentGateway: "razorpay",
    paymentType: "emi_installment",

    // EMI specific tracking
    emiPlanId: emiPlan._id,
    emiDueDay: emiPlan.selectedDueDay,
    emiInstallments: paymentAllocation.emisToPay.map((emi) => ({
      emiId: emi.emiId,
      month: emi.month,
      monthName: emi.monthName,
      amount: emi.amount,
      dueDate: emi.dueDate,
      wasOverdue: emi.isOverdue,
    })),

    // Razorpay details
    razorpayOrderId: paymentDetails.razorpayOrderId,
    razorpayPaymentId: paymentDetails.razorpayPaymentId,
    razorpaySignature: paymentDetails.razorpaySignature,

    // Technical details
    ipAddress: paymentData.ipAddress,
    platform: paymentData.platform || "web",
    isInternational: false,
  });

  await payment.save();

    return payment;
};
